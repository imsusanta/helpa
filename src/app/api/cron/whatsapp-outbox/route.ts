/**
 * Helpa Core Platform — WhatsApp Outbox Cron Worker
 *
 * Secure background worker endpoint for processing pending and retryable
 * outbox delivery jobs with concurrent-safe leasing (FOR UPDATE SKIP LOCKED).
 */

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { authorizeCronRequest } from '@/lib/cron/security';
import { whatsappOutboxService } from '@/core/services/whatsapp-outbox.service';

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

async function handleOutboxWorker(request: Request) {
  const authorization = authorizeCronRequest(request);
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.message },
      { status: authorization.status, headers: NO_STORE_HEADERS }
    );
  }

  const workerId = `cron-outbox-${crypto.randomBytes(4).toString('hex')}`;
  const url = new URL(request.url);
  const batchSize = Math.min(
    Math.max(1, parseInt(url.searchParams.get('batch_size') || '25', 10)),
    100
  );

  try {
    const result = await whatsappOutboxService.claimAndProcessBatch({
      workerId,
      batchSize,
      leaseDurationSeconds: 120,
    });

    return NextResponse.json(
      {
        success: true,
        workerId,
        metrics: result,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error('[whatsapp-outbox-cron] Worker execution failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal worker error',
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function GET(request: Request) {
  return handleOutboxWorker(request);
}

export async function POST(request: Request) {
  return handleOutboxWorker(request);
}
