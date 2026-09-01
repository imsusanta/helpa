import { getAdminClient } from '@/lib/supabase/server';

export const WORKER_HEARTBEAT_STALE_SECONDS = 90;

export type HeartbeatServiceName =
  'whatsapp-outbox-worker' | 'voice-outbox-worker';

export type HeartbeatPublicStatus = 'ok' | 'stale' | 'unknown';

export interface PublicHeartbeat {
  status: HeartbeatPublicStatus;
  lastSeenAt: string | null;
  staleAfterSeconds: number;
}

const PROHIBITED_DETAIL_KEYS = [
  'token',
  'secret',
  'password',
  'key',
  'phone',
  'email',
  'message',
  'message_body',
];

function sanitizeDetails(
  details?: Record<string, unknown>
): Record<string, unknown> {
  if (!details) return {};
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    const lower = key.toLowerCase();
    if (PROHIBITED_DETAIL_KEYS.some((forbidden) => lower.includes(forbidden))) {
      continue;
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export function classifyHeartbeat(
  lastSeenAt: string | null | undefined,
  now: Date = new Date(),
  staleAfterSeconds: number = WORKER_HEARTBEAT_STALE_SECONDS
): HeartbeatPublicStatus {
  if (!lastSeenAt) return 'unknown';
  const seen = Date.parse(lastSeenAt);
  if (!Number.isFinite(seen)) return 'unknown';
  const ageSeconds = (now.getTime() - seen) / 1000;
  if (ageSeconds < 0) return 'ok';
  return ageSeconds <= staleAfterSeconds ? 'ok' : 'stale';
}

export async function touchHeartbeat(
  serviceName: HeartbeatServiceName,
  status: 'ok' | 'error' = 'ok',
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const admin = getAdminClient();
    const { error } = await admin.from('operational_heartbeats').upsert(
      {
        service_name: serviceName,
        last_seen_at: new Date().toISOString(),
        status,
        details: sanitizeDetails(details),
      },
      { onConflict: 'service_name' }
    );
    if (error) {
      console.warn('[heartbeat] upsert skipped:', error.message);
    }
  } catch (err) {
    console.warn(
      '[heartbeat] upsert skipped:',
      err instanceof Error ? err.message : 'unknown'
    );
  }
}

export async function readPublicHeartbeat(
  serviceName: HeartbeatServiceName
): Promise<PublicHeartbeat> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('operational_heartbeats')
      .select('last_seen_at')
      .eq('service_name', serviceName)
      .maybeSingle();
    if (error || !data) {
      return {
        status: 'unknown',
        lastSeenAt: null,
        staleAfterSeconds: WORKER_HEARTBEAT_STALE_SECONDS,
      };
    }
    const lastSeenAt =
      typeof data.last_seen_at === 'string' ? data.last_seen_at : null;
    return {
      status: classifyHeartbeat(lastSeenAt),
      lastSeenAt,
      staleAfterSeconds: WORKER_HEARTBEAT_STALE_SECONDS,
    };
  } catch {
    return {
      status: 'unknown',
      lastSeenAt: null,
      staleAfterSeconds: WORKER_HEARTBEAT_STALE_SECONDS,
    };
  }
}
