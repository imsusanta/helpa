# Production workers and scheduled jobs

Helpa does **not** use BullMQ. Durable work is either:

1. A long-running **5-second poller** (`npm run worker`) that reconciles the WhatsApp outbox and the voice provider-event outbox, or
2. **HTTP cron routes** protected by `authorizeCronRequest` (`src/lib/cron/security.ts`).

`REDIS_URL` is for **shared rate-limit counters** across serverless instances (`src/lib/rate-limit.ts`). It is not a job queue. Local/single-node development can omit it; production should set it so limits are not per-instance.

## Required configuration

- `REDIS_URL`: shared rate-limit store (optional locally, required for multi-instance production).
- `CRON_SECRET`: secret for `/api/cron/reminders`, `/api/cron/campaigns`, and as a fallback on other crons.
- `AUTOMATION_CRON_SECRET`: accepted (with `CRON_SECRET`) by automations, flows, cleanup, and subscription-lifecycle crons.

Use different values in development, staging, and production. Send secrets only in the `x-cron-secret` header or `Authorization: Bearer`; never put them in a query string.

If **no** candidate secret is configured, cron routes return **503**. They never fail open, including in non-production.

## Run the worker

```bash
npm run worker
```

Run this in a persistent container or VPS process, not a standard serverless function. `scripts/worker.ts` loops every 5 seconds and:

1. Calls `OutboxService.reconcilePendingMessages()` for WhatsApp outbound reconciliation (does not re-send to Meta on reconcile).
2. Calls `VoiceOutboxWorker.processPendingEvents()` for voice provider events.

There is no Redis-backed job queue behind this process.

## HTTP cron inventory

See `ROUTE_SECURITY_MATRIX.md` §4 for the full table.

`vercel.json` currently schedules only:

- `/api/cron/subscription-lifecycle` — daily midnight UTC
- `/api/cron/campaigns` — daily 01:00 UTC

Reminders, webhook cleanup, automations drain, and flow timeout sweeps must be invoked by an external scheduler, for example:

```bash
curl -fsS \
  -H "x-cron-secret: $CRON_SECRET" \
  "$NEXT_PUBLIC_SITE_URL/api/cron/reminders"
```

Campaign cron loads audiences, contacts, and conversations **scoped by `account_id`**. It does not scan other tenants' rows.

## Operational checks

- Alert when Redis is unavailable if you rely on it for production rate limits (the limiter falls back to in-memory, which is not shared across instances).
- Run exactly one worker process per environment until load-tested.
- Keep `CRON_SECRET` / `AUTOMATION_CRON_SECRET` set in every deployed environment that can reach tenant data.
- Persist worker heartbeat in `worker_health` (voice worker) and review `outbound_outbox` / `provider_events` for stuck rows.
