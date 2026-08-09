# Production workers and reminder cron

Helpa uses Redis and BullMQ for work that must not run inside a serverless request.

## Required configuration

- `REDIS_URL`: connection URL for the environment-specific Redis database.
- `CRON_SECRET`: long random secret for production cron routes.
- `AUTOMATION_CRON_SECRET`: separate secret for the legacy automation wait-step cron.

Use different values in development, staging, and production. Send cron secrets only in the `x-cron-secret` header; never put them in a URL or query string.

## Run the worker

```bash
npm run worker
```

Run this command in a persistent container or VPS process, not a standard serverless function. The worker currently executes appointment reminder jobs from the `followups` queue. Other queue processors remain placeholders until their provider implementations land.

## Invoke reminder scheduling

```bash
curl -fsS \
  -H "x-cron-secret: $CRON_SECRET" \
  "$NEXT_PUBLIC_SITE_URL/api/cron/reminders"
```

The route validates the secret, evaluates each clinic in its configured IANA timezone, and enqueues idempotently named 24-hour and 2-hour reminder jobs. It does not contact WhatsApp directly.

## Operational checks

- Alert when Redis is unavailable or the follow-up queue has failed jobs.
- Run exactly one worker service per environment initially; scale concurrency only after load testing.
- Set every account timezone before enabling reminders.
- Keep failed jobs for triage and review logs for reminder sends whose CRM status update failed.
