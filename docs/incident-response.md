# Incident-response runbooks

**Status:** `PROCEDURES READY — GAME DAYS NOT EXECUTED IN THIS CHANGE`  
No secrets, tokens, or patient content belong in tickets, screenshots, or this file.

Severity: **SEV-1** patient-facing outage or suspected breach · **SEV-2** degraded clinic workflow · **SEV-3** limited/internal.

Shared verification: `GET /api/health`, `GET /api/health/ready`, `GET /api/whatsapp/config` (authenticated), Settings → Clinic readiness, dead-letter admin, worker heartbeat.

## A) WhatsApp webhook stops

| Step | Action |
| --- | --- |
| Detection | Health/WhatsApp last webhook time stale; inbound volume drops; provider retries; `webhook_failed` events |
| Severity | SEV-1 if no inbound for a live clinic; SEV-2 if one tenant |
| Containment | Do not rotate secrets blindly. Pause campaigns. Keep the worker running for outbound reconcile |
| Investigation | Signature failures vs 5xx persist vs provider outage. Check `inbound_webhook_events` / dead-letter counts, not payloads, in shared chat |
| Recovery | Fix verify token / HMAC / persist. Ask provider to replay only after persist is healthy |
| Verification | Synthetic inbound on staging; clinic sees a new fictional thread |
| Communication | Clinic: "Inbound WhatsApp is delayed; send is unchanged" until verified |
| Review | Why signature or persist failed; whether idempotency dropped a retry |

## B) Outbound accepted but missing from Inbox

| Step | Action |
| --- | --- |
| Detection | Clinic reports a delivered WhatsApp with no bubble; outbox `sent` / `reconciliation_required` |
| Severity | SEV-2 (trust break); SEV-1 if widespread |
| Containment | Stop retries that would double-send. Do not paste message bodies into Slack |
| Investigation | `persistOutboundMessage` result; tenant-scoped provider id lookup; Evolution/WAHA echo path |
| Recovery | Worker reconcile from outbox snapshot; if needed, persist from provider id without resending |
| Verification | Send a **test** template/text to a staff-owned number; refresh Inbox |
| Communication | "The message was delivered; history backfill is in progress" |
| Review | Confirm P0 persist path from this branch is deployed |

## C) AI incorrect responses

| Step | Action |
| --- | --- |
| Detection | Staff report; `ai_failed`; safety eval miss |
| Severity | SEV-1 if clinical advice / emergency mishandled; otherwise SEV-2 |
| Containment | Pause AI on the conversation (`ai_chat_enabled=false`). Optionally disable account chatbot master switch |
| Investigation | Prompt, KB, and tool results **without** copying patient text off-platform |
| Recovery | Correct KB; keep AI paused until a clinician/owner approves |
| Verification | Staging replay with fictional symptoms only |
| Communication | Patient: staff takeover message. Internal: no screenshots of PHI |
| Review | Add a regression in `src/tests/ai/` when the failure mode is reproducible |

## D) Suspected unauthorized tenant access

| Step | Action |
| --- | --- |
| Detection | Audit log anomalies; cross-tenant IDs in requests; user report |
| Severity | SEV-1 |
| Containment | Revoke sessions in Supabase Auth. Disable the suspected user. Do not dump `messages` |
| Investigation | `audit_logs`, membership changes, API account binding. Compare `account_id` on the resource |
| Recovery | Rotate affected credentials; confirm RLS still forced |
| Verification | User cannot see the other tenant; invite/role matrix rechecked |
| Communication | Owners of affected tenants only; legal as required |
| Review | Whether a new route used service-role without session `account_id` |

## E) Bad production migration

| Step | Action |
| --- | --- |
| Detection | Deploy health `databaseMigrationStatus=unavailable`; 5xx on core routes; Supabase advisor |
| Severity | SEV-1 |
| Containment | Stop further deploys. Do **not** run experimental SQL on production to "try" a fix |
| Investigation | Migration file, `supabase/migrations` order, RLS enablement |
| Recovery | Follow `docs/operations/runbook-backup-restore.md` on a **staging restore** first. Production rollback only with operator PITR |
| Verification | `/api/health/ready` 200; login; one tenant inbox read |
| Communication | "Workspace is read-only / delayed" — never publish schema details |
| Review | Add a migration validator case if the failure was structural |

## F) Compromised integration credentials

| Step | Action |
| --- | --- |
| Detection | Unexpected outbound, Meta alerts, leaked env, unauthorized Evolution instance |
| Severity | SEV-1 |
| Containment | Disconnect WhatsApp for the tenant; rotate `ENCRYPTION_KEY` only with the key-rotation runbook; revoke Meta/Evolution tokens in the provider console |
| Investigation | `whatsapp_configs` updated_at, audit logs. Do not write the old token into tickets |
| Recovery | Re-encrypt, reconnect, confirm webhook signature |
| Verification | Config health connected; test message to a staff number |
| Communication | Clinic owner + provider trust/safety as required |
| Review | How the secret left the host; secret scanning gaps |

## Safe health checks

- `GET /api/health/live` — process up, no DB
- `GET /api/health/ready` — DB reachable or 503
- Worker `checks.worker.status` is `ok` \| `stale` \| `unknown` (no error strings)
- Never put `SUPABASE_SERVICE_ROLE_KEY`, access tokens, or phone numbers in health JSON
