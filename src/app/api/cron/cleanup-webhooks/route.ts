import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { appwriteAdmin, getAdminClient } from '@/lib/appwrite-compat';

/**
 * Retention Cleanup Cron Endpoint
 *
 * Enforces the raw webhook payload retention policy:
 * - Completed webhook events older than 7 days have their raw payload sanitized.
 * - Dead-letter and failed webhook records older than 30 days are purged.
 * - Outbound outbox completed records older than 14 days are cleaned up.
 *
 * Authentication: Header 'x-cron-secret' must match AUTOMATION_CRON_SECRET / CRON_SECRET.
 * Fails closed if no secret is configured.
 */
export async function POST(request: Request) {
  const expected =
    process.env.AUTOMATION_CRON_SECRET || process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: 'Cron secret not configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store, private' } }
    );
  }

  const supplied = request.headers.get('x-cron-secret') || '';
  const expectedBuf = Buffer.from(expected, 'utf8');
  const suppliedBuf = Buffer.from(supplied, 'utf8');

  if (
    expectedBuf.length !== suppliedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, suppliedBuf)
  ) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store, private' } }
    );
  }

  const db = getAdminClient();
  const now = new Date();

  // 1. Sanitize completed webhook payloads older than 7 days
  const sevenDaysAgo = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: sanitizedEvents, error: sanitizeErr } = await db
    .from('inbound_webhook_events')
    .update({
      payload: {
        sanitized: true,
        reason: 'Retention policy: older than 7 days',
      },
      updated_at: now.toISOString(),
    })
    .eq('status', 'completed')
    .lt('created_at', sevenDaysAgo)
    .select('id');

  if (sanitizeErr) {
    console.error(
      '[Retention Cleanup] Failed to sanitize completed webhook events:',
      sanitizeErr.message
    );
  }

  // 2. Purge dead-letter and failed events older than 30 days
  const thirtyDaysAgo = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: purgedEvents, error: purgeErr } = await db
    .from('inbound_webhook_events')
    .delete()
    .in('status', ['dead_letter', 'failed'])
    .lt('created_at', thirtyDaysAgo)
    .select('id');

  if (purgeErr) {
    console.error(
      '[Retention Cleanup] Failed to purge aged dead-letter events:',
      purgeErr.message
    );
  }

  // 3. Purge sent outbox records older than 14 days
  const fourteenDaysAgo = new Date(
    now.getTime() - 14 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: purgedOutbox, error: outboxErr } = await db
    .from('outbound_outbox')
    .delete()
    .eq('status', 'sent')
    .lt('created_at', fourteenDaysAgo)
    .select('id');

  if (outboxErr) {
    console.error(
      '[Retention Cleanup] Failed to purge sent outbox records:',
      outboxErr.message
    );
  }

  return NextResponse.json(
    {
      success: true,
      sanitized_completed_events: sanitizedEvents?.length || 0,
      purged_dead_letter_events: purgedEvents?.length || 0,
      purged_sent_outbox: purgedOutbox?.length || 0,
      timestamp: now.toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store, private' } }
  );
}
