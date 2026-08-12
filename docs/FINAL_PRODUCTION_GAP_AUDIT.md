# Helpa final production gap audit

Baseline branch: `fix/production-readiness-final`

Starting `main` SHA: `aaa552af9f05d3fecb176b5f3d99f6aac101f885`

Audited on 2026-08-11 after `git pull --ff-only origin main` and `npm ci`.

## Baseline commands

| Command                        | Result                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------ |
| `npm ci`                       | Pass; 752 packages installed; npm reported one low vulnerability               |
| `npm run format:check`         | Pass                                                                           |
| `npm run lint`                 | Pass with zero warnings                                                        |
| `npm run typecheck`            | Pass                                                                           |
| `npm test`                     | Pass; 53 files / 524 tests                                                     |
| `npm run test:integration`     | Pass; 4 tests                                                                  |
| `npm run build`                | Pass, with an unresolved optional BullMQ `@valkey/valkey-glide` module warning |
| `npm run test:e2e`             | Fail: 14 passed, 3 failed                                                      |
| `npm audit --audit-level=high` | Not verifiable: npm registry DNS failed in this environment                    |

The failed Playwright report was inspected from `test-results/`. Failures were:

- `/api/health` returned truthful `503` without Appwrite/database connectivity.
- The lead Kanban test landed on the login page instead of an authenticated fixture.

## P0/P1 findings before remediation

- `src/app/api/whatsapp/send/route.ts` selected the first same-account contact and first conversation when explicit recipient resolution or conversation creation failed. This could send to the wrong patient.
- `src/lib/appwrite-compat.ts` retried a filtered Appwrite query as an unfiltered collection query on schema/index errors, and generated a hard-coded virtual profile (`user_susanta`, `default_account`, `admin@clinic.local`).
- `src/lib/appwrite-compat.ts` stored Appwrite session secrets in `localStorage` and a JavaScript-readable `appwrite_session` cookie; `src/infrastructure/appwrite/client.ts` read that storage.
- `src/app/api/auth/login/route.ts` returned `sessionSecret` in JSON and set a non-HttpOnly session cookie.
- `src/app/api/webhooks/waha/route.ts`, Calendly, and SMS webhook paths trusted body `account_id`, inserted a default UUID, and marked events `processed` before asynchronous processing.
- `src/core/providers/whatsapp/waha-provider.ts` used a global `default` session, generated message IDs, and represented templates as text.
- `src/core/providers/calendly/calendly-provider.ts`, `src/core/providers/sms/exotel-provider.ts`, and related provider paths contained dummy credentials or generated provider IDs.
- `src/queues/workers/multichannel-followup.ts` had an empty provider-event processor and outbound jobs did not persist command/event outcomes.
- Runtime `src/` still contains legacy Supabase-shaped calls through the compatibility adapter; this remains a migration scope item and must not be described as production-ready until removed.

## Schema and deployment gaps

`scripts/setup-appwrite-db.ts` created every collection with `Role.users()` collection permissions and no attributes/indexes. It exited successfully when `APPWRITE_API_KEY` was absent. `scripts/verify-appwrite-db.ts` only verified collection existence and also skipped successfully without an API key. There was no versioned schema manifest or exact permission/attribute/index verification.

## Acceptance status

No live provider, staging tenant-isolation, Redis worker heartbeat, CI workflow, or production deployment evidence was available in this local checkout. Providers without verified credentials must remain explicitly unavailable; no live success is inferred from code or local mocks.
