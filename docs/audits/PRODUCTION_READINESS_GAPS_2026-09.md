# Final production-readiness audit (gaps pass)

**Date:** 2026-09-01  
**Repository:** `https://github.com/imsusanta/helpa`  
**Production host:** `https://www.helpa.studio`  
**Base:** `origin/main` @ `96d68f5d`  
**Branch:** `cursor/production-readiness-gaps-5264`  
**Method:** code and test evidence in this repository. No invented customers, testimonials, 30-day results, pentest completion, uptime, or screenshots.

This supersedes older Appwrite-era “NO-GO” reports as the **current** scorecard. Historical files under `docs/audits/` remain evidence of past work; they are not current measurements.

## Scores (1–10)

| Area | Score | Why |
| --- | ---: | --- |
| Architecture | 7 | Next.js 16 + Supabase cutover is the runtime. Appwrite rollback paths and dual-client aliases remain. |
| Security | 7 | RLS, HMAC, encryption, and role gates exist and have tests. No independent pentest. Service-role misuse remains a standing risk. |
| Testing | 7 | Verified this pass: format/lint/typecheck clean; `npm test` 193 files / 1447 tests; integration 10; `supabase:validate` ok; `next build` ok; e2e 41 passed / 1 skipped (demo capture). |
| WhatsApp reliability | 7 | Outbox + persist-outbound (P0 from #216, rebased here) is implemented. Live Meta/Evolution echo still needs a human number. |
| AI reliability | 6 | Safety evals and fail-closed clinical refusal exist. Incorrect-answer IR is documented; no production AI failure rate. |
| CRM / workplace | 7 | Inbox, appointments, automations (`insertAutomationRow`), travel, and dashboard wiring are present. Pilot clinics are not enrolled. |
| UI / UX | 6 | Reception workflows exist; this pass does not redesign. Demo screenshots are not captured. |
| Accessibility | 6 | Login/composer labels, inbox search/filter/AI/status/assign labels, appointment tablist, alerts. No full WCAG audit or keyboard e2e. |
| Mobile | 6 | Composer hint wrap, appointment tab overflow-x, inbox list/thread split, unauth mobile overflow e2e. No Cloud Agent device pass of login → inbox → reply. |
| Observability | 6 | Event contract, producers, aggregates, heartbeats, health checks. Window not started. |
| Backup / recovery | 4 | Staging restore procedure written. No drill recorded. PITR is operator-owned. |
| Incident response | 6 | Six runbooks + health/heartbeat hooks. Game days not run. |
| Production readiness | 5 | Code is closer to a controlled pilot. Healthcare production still has external gates. |

**Average of the 13 scores: 6.2 / 10.**  
**Final rating: 6 / 10.**

## Recommendation

**CONDITIONALLY PRODUCTION READY**

Conditions (all required before calling a clinic “live” with real patients):

1. Merge this branch (includes P0 Inbox outbound persist that is still absent on `main`).
2. Human staging demo capture with fictional data only.
3. Operator enables Supabase backups/PITR and records a **staging** restore drill.
4. Start the 30-day observation clock; do not publish numbers early.
5. Engage an independent pentest; do not claim it from this document.
6. Legal / DPDP / healthcare review for the jurisdiction.
7. Worker + cron actually running in the target environment.
8. Each pilot clinic completes `docs/clinic-pilot-readiness.md` with real names (not invented ones).

**Not** production-ready for an unrestricted multi-clinic healthcare launch.

## Completed (implemented and verified in repo)

- P0/P1 from draft #216 rebased onto current `main`: Evolution/WAHA outbound persist, tenant-scoped lookups, onboard KB/automations via `insertAutomationRow`, dashboard/members/follow-up wiring.
- Privacy-safe observation event names + producers + tenant aggregate API.
- Worker heartbeat + health `auth` / `worker` checks without secrets.
- Pilot readiness API + Settings card (counts only).
- Demo journey unit coverage for fictional fixtures.
- Docs: observation, SLO (empty Observed), IR, pentest readiness, backup/restore procedure, pilot checklist, this audit.
- Minimal a11y labels on inbox search, filters, AI pause, status/assign, composer, and appointment tabs; mobile overflow e2e on reception routes.

## Ready but requires external / human action

- Seven screenshots and 90s walkthrough (`docs/PRODUCT_DEMO.md`).
- 30-day production observation start + finish.
- 3–5 real clinic enrollments.
- Independent penetration test and retest letter.
- Staging/production restore drill and PITR enablement.
- IR game days.
- Observed SLO cells.
- Full keyboard and mobile device audit.
- Branch protection and release SHA reconciliation (`docs/10-OUT-OF-10-ROADMAP.md`).
- Irreversible Appwrite removal.

## Remaining risks

- P0 persist is not on `main` until this (or #216) merges.
- Service-role APIs can regress isolation if a new handler skips session `account_id`.
- Worker absence silently stalls outbox reconcile (heartbeat will go `stale` only after deploy of this branch).
- No measured availability, delivery, or AI rates.
- Storage objects and provider subscriptions are outside Postgres backup.
- Rate limits / WAF are hosting-dependent.
- Healthcare claims remain legally uncertified (`SECURITY.md`).
