/**
 * WhatsApp QR linked-device session for Evolution Go v0.7.2.
 *
 * Production traffic talks to Evolution Go through the server-only
 * connection service. Synthetic QR strings and simulate_paired are
 * test/demo-only and fail closed when NODE_ENV=production.
 */

import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';
import {
  EvolutionGoConfigError,
  isWhatsAppQrSimulationAllowed,
  runWithEvolutionDeadline,
} from '@/core/providers/whatsapp/evolution-go-env';
import { EvolutionGoRequestError } from '@/core/providers/whatsapp/evolution-go-client';
import {
  disconnectEvolutionQrSession,
  getEvolutionQrSession,
  publicErrorMessage,
  reconnectEvolutionQrSession,
  startEvolutionQrSession,
  toPublicQrSession,
  type EvolutionQrSessionResponse,
} from '@/core/whatsapp/evolution-connection';
import { getAdminClient } from '@/lib/db/server';
import { encrypt } from '@/lib/whatsapp/encryption';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function noStoreJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, no-cache, must-revalidate',
    },
  });
}

function stripSecrets<T extends Record<string, unknown>>(payload: T): T {
  const clone = { ...payload };
  delete clone.token;
  delete clone.apikey;
  delete clone.apiKey;
  delete clone.instanceToken;
  delete clone.access_token;
  delete clone.encrypted_access_token;
  delete clone.provider_token_encrypted;
  delete clone.webhook_secret;
  delete clone.webhook_secret_hash;
  return clone;
}

function qrSessionHttpStatus(session: EvolutionQrSessionResponse): number {
  if (session.success) return 200;
  if (session.conflict) return 409;
  return session.failure_status ?? 502;
}

function publicQrSessionJson(
  session: EvolutionQrSessionResponse
): NextResponse {
  return noStoreJson(
    stripSecrets(
      toPublicQrSession(session) as unknown as Record<string, unknown>
    ),
    qrSessionHttpStatus(session)
  );
}

function qrPayload(error: string) {
  return {
    success: false,
    status: 'error' as const,
    error,
    qr_code: null,
    qr_image: null,
    expires_in: null,
    provider: 'evolution' as const,
    connection_type: 'qr_linked_device' as const,
  };
}

function qrRouteErrorResponse(err: unknown): NextResponse {
  if (err instanceof EvolutionGoConfigError) {
    return noStoreJson(qrPayload(err.message), 503);
  }
  if (err instanceof EvolutionGoRequestError) {
    const status = err.status === 504 ? 504 : err.status === 503 ? 503 : 502;
    return noStoreJson(qrPayload(publicErrorMessage(err)), status);
  }
  return toErrorResponse(err);
}

export async function GET() {
  try {
    return await runWithEvolutionDeadline(async () => {
      const ctx = await requireRole('admin');
      const rateLimit = await checkRateLimit(
        `qr_poll_${ctx.userId}`,
        RATE_LIMITS.whatsappQrPoll
      );
      if (!rateLimit.success) {
        return rateLimitResponse(rateLimit);
      }
      const session = await getEvolutionQrSession(ctx.accountId);
      return noStoreJson(
        stripSecrets(
          toPublicQrSession(session) as unknown as Record<string, unknown>
        )
      );
    });
  } catch (err: unknown) {
    return qrRouteErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    return await runWithEvolutionDeadline(async () => {
      const ctx = await requireRole('admin');
      const rateLimit = await checkRateLimit(
        `qr_session_${ctx.userId}`,
        RATE_LIMITS.adminAction
      );
      if (!rateLimit.success) {
        return rateLimitResponse(rateLimit);
      }

      const body = await request.json().catch(() => ({}));
      const action = String(body?.action || 'generate').trim();

      if (action === 'simulate_paired' || body?.simulate_phone) {
        if (!isWhatsAppQrSimulationAllowed()) {
          return noStoreJson(
            {
              success: false,
              error: 'QR pairing simulation is disabled.',
            },
            403
          );
        }
        const simulatedPhone = String(body?.simulate_phone || '918927093059');
        const db = getAdminClient();
        const now = new Date().toISOString();
        const fakeDeviceId = `evolution:sim_${crypto.randomBytes(8).toString('hex')}`;
        const encrypted = encrypt(
          `evolution-sim-${crypto.randomBytes(16).toString('hex')}`
        );
        const configPayload = {
          account_id: ctx.accountId,
          phone_number_id: fakeDeviceId,
          provider: 'evolution',
          connection_type: 'qr_linked_device',
          encrypted_access_token: encrypted,
          provider_token_encrypted: encrypted,
          display_phone_number: simulatedPhone,
          verified_name: 'WhatsApp Business Linked Device',
          status: 'connected',
          connection_status: 'connected',
          registered_at: now,
          connected_at: now,
          updated_at: now,
        };
        const { data: existing } = await db
          .from('whatsapp_configs')
          .select('id')
          .eq('account_id', ctx.accountId)
          .maybeSingle();
        if (existing?.id) {
          await db
            .from('whatsapp_configs')
            .update(configPayload)
            .eq('id', existing.id)
            .eq('account_id', ctx.accountId);
        } else {
          await db.from('whatsapp_configs').insert(configPayload);
        }
        return noStoreJson({
          success: true,
          status: 'connected',
          phone_number: simulatedPhone,
          provider: 'evolution',
          is_qr_linked: true,
        });
      }

      if (action === 'reconnect') {
        const session = await reconnectEvolutionQrSession(ctx.accountId);
        return publicQrSessionJson(session);
      }

      const session = await startEvolutionQrSession(ctx.accountId);
      return publicQrSessionJson(session);
    });
  } catch (err: unknown) {
    return qrRouteErrorResponse(err);
  }
}

export async function DELETE() {
  try {
    return await runWithEvolutionDeadline(async () => {
      const ctx = await requireRole('admin');
      const rateLimit = await checkRateLimit(
        `qr_session_${ctx.userId}`,
        RATE_LIMITS.adminAction
      );
      if (!rateLimit.success) {
        return rateLimitResponse(rateLimit);
      }
      const result = await disconnectEvolutionQrSession(ctx.accountId);
      return noStoreJson(result);
    });
  } catch (err: unknown) {
    return qrRouteErrorResponse(err);
  }
}
