# Helpa SaaS production runbook

## 1. Production architecture decision

- **Primary application runtime:** Vercel, including Next.js server routes.
- **Primary auth and database:** Supabase in `cutover` mode.
- **Background processing:** a separately deployed long-running worker using the same release SHA and environment configuration.
- **Netlify:** preview/compatibility configuration only. It is not a production target unless an explicit architecture decision proves feature, secret, worker, and rollback parity.
- **Appwrite:** temporary rollback compatibility only. New product features must not add Appwrite persistence. Remove the compatibility layer after all callers and rollback data paths are migrated.

Production startup must use:

```bash
AUTH_PROVIDER=supabase
DATABASE_PROVIDER=supabase
MIGRATION_MODE=cutover
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Missing credentials or a non-cutover production mode must fail startup. Never add credential defaults to source, examples, tests, or deployment files.

## 2. Durable jobs and messaging

WhatsApp sends use the Postgres `whatsapp_outbox`. The application persists an account-scoped idempotency row before the provider side effect. Provider success is stored with the provider message ID; if local message persistence fails, reconciliation repairs local state without sending to Meta again.

Operational requirements:

- one worker release per application release;
- bounded batches and per-account concurrency;
- lease expiry and recovery for claimed work;
- exponential retry with jitter;
- dead-letter inspection and replay tooling;
- graceful shutdown that stops claims before draining active jobs;
- alerts on queue age, retry rate, dead-letter growth, and stale heartbeat.

Do not document Redis/BullMQ as required unless the deployed worker actually uses it. Voice events still using Appwrite `provider_events` are migration debt and must remain isolated from the canonical WhatsApp outbox.

## 3. Secret rotation

If a credential reaches source control, removing it from the latest commit is not enough.

1. Create a replacement credential at the provider.
2. Update Vercel, the worker, CI, and any approved local secret manager.
3. Deploy and verify health checks, auth, webhooks, and one non-destructive database operation.
4. Revoke the exposed credential immediately after verification.
5. Review provider audit logs from the first exposure time.
6. Rotate dependent webhook or encryption secrets if compromise is plausible.
7. Run repository and Git-history secret scans.
8. Rewrite Git history only as a separately coordinated incident action; history rewriting does not replace revocation.

The Supabase service-role key previously embedded in runtime configuration must be rotated. Treat the public anonymous key as public by design, but rotate it too if project policy requires a clean credential set.

## 4. Backup and recovery

Baseline objectives until the business approves stricter targets:

- **RPO:** 24 hours maximum.
- **RTO:** 4 hours maximum for core auth, tenant data, and inbound/outbound messaging state.

Controls:

- enable provider-managed database backups and point-in-time recovery where available;
- export encryption-key custody and restore instructions to a restricted secret manager;
- test a restore into an isolated project at least quarterly;
- verify row counts, RLS policies, migrations, account membership, subscriptions, outbox state, and encrypted credential readability;
- record actual restore time and data loss, then update RPO/RTO evidence;
- never run a restore drill against production.

## 5. Observability and SLOs

Initial service objectives:

- API availability: 99.9% monthly for authenticated core routes.
- Webhook acknowledgement: 99% under 2 seconds, excluding provider outages.
- Outbox age: 99% of ready jobs begin processing within 60 seconds.
- Cross-tenant authorization failures: zero tolerated.
- Payment idempotency conflicts or amount mismatches: alert immediately.

Every request, webhook, job, payment, and provider call needs a correlation ID. Dashboards should segment by release SHA and tenant without exposing message bodies or personal data.

Page immediately on:

- stale worker heartbeat;
- database or auth unavailability;
- service-role authorization anomalies;
- invalid webhook-signature spikes;
- payment processing stuck in `pending`;
- dead-letter growth;
- unusual AI or WhatsApp spend.

## 6. Payment operations

- `RAZORPAY_WEBHOOK_SECRET` is mandatory; missing or invalid signatures fail closed.
- Account, plan, order, payment ID, currency, and amount must come from verified provider data.
- Never invent payment or order identifiers.
- Reject unknown/inactive plans and amount mismatches.
- Keep provider payment IDs unique and account-scope every subsequent update.
- Reconcile any `pending` payment before retrying a subscription mutation.

## 7. Module launch gate

A module marked `COMING_SOON` must not be selectable for production onboarding and must not expose routes or APIs. Activation requires:

- manifest and canonical industry identifiers;
- route/API authorization, not sidebar hiding;
- tenant-isolation tests;
- plan-feature tests;
- migrations and rollback plan;
- operational dashboards and support documentation;
- product acceptance.

## 8. Compliance boundary

Helpa must not claim HIPAA, GDPR, or healthcare compliance solely because encryption and RLS exist. Before regulated health data is accepted, complete a data-flow inventory, retention/deletion policy, access review, vendor DPA/BAA review where applicable, incident-response process, audit-log retention, and documented security risk assessment.

Use minimum-necessary data in AI prompts and logs. Do not send protected health information to an AI provider until contractual and technical controls explicitly permit it.

## 9. Release and rollback

Before promotion:

1. Apply migrations to staging from a clean baseline.
2. Run formatting, lint, typecheck, unit/integration tests, dependency audit, secret scan, build, and critical E2E flows.
3. Verify Super Admin, billing, webhook, outbox, and negative cross-tenant tests.
4. Deploy app and worker with the same SHA.
5. Run smoke tests and inspect alerts.
6. Keep database migrations backward-compatible for the rollback window.

Rollback application code only when the deployed schema remains compatible. Do not switch production back to Appwrite without an incident commander, explicit data-reconciliation plan, and verified rollback credentials.
