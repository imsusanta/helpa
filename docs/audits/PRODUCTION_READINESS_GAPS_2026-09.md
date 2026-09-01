# Final production-readiness audit (gaps pass, 2026-09-01)

**Date:** 2026-09-01  
**Repository:** `https://github.com/imsusanta/helpa`  
**Production host:** `https://www.helpa.studio`  
**Live main:** `origin/main` @ `f5fe77f3`  
**Branch:** `cursor/production-readiness-gaps-5264` (includes merge of `origin/main`)  
**Method:** code and test evidence in this repository. No invented customers, testimonials, 30-day results, pentest completion, uptime, SLO observed numbers, or screenshots.

This supersedes older Appwrite-era “NO-GO” reports and the earlier 6/10 draft of this file as the **current** scorecard. Historical files under `docs/audits/` remain evidence of past work; they are not current measurements.

**This is not 10/10.** A true 10/10 is not achievable from repository work alone.

## Scores — Target vs Observed

| Area | Target | Live main (`f5fe77f3`) | This branch | Why this branch is not 10 |
| --- | ---: | ---: | ---: | --- |
| Architecture | 10 | 7 | 7 | Next.js 16 + Supabase is the runtime. Appwrite rollback paths remain. |
| Security | 10 | 6 | 8 | RLS/HMAC/encryption/role gates + remaining provider-id writes now require `account_id`. No independent pentest. |
| Testing | 10 | 6 | 8 | Verified this pass (see Quality gates). No keyboard-only e2e. CI thresholds were not lowered. |
| WhatsApp reliability | 10 | 5 | 8 | Evolution/WAHA outbound persist + tenant-scoped lookups are in this branch, not on `main`. Live echo still needs a human number. |
| AI reliability | 10 | 6 | 6 | Safety evals and fail-closed clinical refusal exist. No production AI failure rate. |
| CRM / workplace | 10 | 6 | 7 | Inbox, appointments, automations (`insertAutomationRow`), travel, dashboard wiring. No enrolled pilots. |
| UI / UX | 10 | 6 | 6 | Reception workflows exist. No redesign. Demo screenshots not captured. |
| Accessibility | 10 | 5 | 7 | Additional reception icon labels (attach, recording, scroll, reactions, report actions). No WCAG audit or keyboard e2e. |
| Mobile | 10 | 5 | 6 | Unauth mobile overflow e2e exists. No authenticated device pass of login → inbox → reply. |
| Observability | 10 | 4 | 7 | Producers, pairing, heartbeat, health checks. Observation window **not started**. Observed SLO cells empty. |
| Backup / recovery | 10 | 3 | 4 | Staging restore procedure written. No drill recorded. PITR is operator-owned. |
| Incident response | 10 | 5 | 6 | Six runbooks + health/heartbeat hooks. Game days not run. |
| Production readiness | 10 | 5 | 6 | Code is closer to a controlled pilot. Healthcare production still has external gates. |

**Live main average (13 areas): 5.3 / 10. Final live rating: 5 / 10. NOT PRODUCTION READY.**

**This branch average (13 areas): 7.0 / 10. Final branch rating: 7 / 10. CONDITIONALLY PRODUCTION READY.**

Do not read 7 as 10. Categories that are 4–6 still block an unrestricted healthcare launch.

## Recommendation

**CONDITIONALLY PRODUCTION READY** for a **controlled staging / first-clinic rehearsal** after merge + deploy + the human gates below.

**Not** production-ready for an unrestricted multi-clinic healthcare launch.

**Not** 10/10.

## Quality gates (verified this pass)

Recorded 2026-09-01 in this environment. Thresholds were not changed.

| Gate | Result |
| --- | --- |
| `npm run format:check` | pass |
| `npm run lint` (`--max-warnings=0`) | pass |
| `npm run typecheck` | pass |
| `npm test` | 194 files / 1457 tests passed |
| `npm run test:integration` | 10 passed |
| `npm run supabase:validate` | ok (includes `20260901060000_reliability_observation.sql`) |
| `npm run build` | pass (`next build`) |
| `npm run test:e2e` | 41 passed / 1 skipped (`DEMO_CAPTURE`) |

Safety, RLS, webhook HMAC, encryption, role gates, rate limits, and CI thresholds were not loosened. No tests were skipped, disabled, or deleted to go green.

## Completed (code — implemented and verified in repo)

- P0/P1 from draft #216 rebased onto current `main`: Evolution/WAHA outbound persist, tenant-scoped lookups, onboard KB/automations via `insertAutomationRow`, dashboard/members/follow-up wiring.
- `handleStatusUpdate` refuses message writes when the webhook did not resolve a tenant; provider-id updates always include `account_id`.
- Meta/flow `lookupInternalIdByMetaId` / `lookupTenantMessageId` and inbound message counts are tenant-scoped.
- Meta inbound persist records privacy-safe `inbound_message_received` (conversation UUID only).
- First-response latency pairing: persist-time `response_time_seconds` from the latest tenant-scoped inbound row; aggregation pairs inbound + first-response by conversation id when the attribute is missing. No patient content.
- Worker heartbeat + health `auth` / `worker` / database checks without secrets.
- Pilot readiness API + Settings card (counts only).
- Demo journey unit coverage for fictional fixtures.
- Reception a11y labels including attach, recording stop/cancel, scroll-to-latest, reactions, report PDF/WhatsApp actions.
- Docs: observation, SLO (empty Observed), IR, pentest readiness, backup/restore procedure, pilot checklist, this audit.

## Ready / Awaiting External (cannot be completed by code)

- Merge + deploy this branch (P0 persist is still absent on `main`).
- Human staging demo capture (seven screenshots + 90s walkthrough) with fictional data only.
- Dated 30-day observation start + finish. Do not publish numbers early.
- Independent penetration test and retest letter.
- Staging restore drill and PITR enablement (operator-owned).
- IR game days.
- Observed SLO cells filled from a real window (never from this document).
- Worker + cron actually running in the target environment.
- Full keyboard and mobile device audit (authenticated login → inbox → reply).
- Branch protection requiring all CI jobs on `main`.
- Legal / DPDP / healthcare review.
- Irreversible Appwrite removal.

## Blocked (not a code task)

- 3–5 real clinic pilots with real names (not invented).
- Production uptime / SLO observed numbers.
- Customer testimonials.
- Claiming 10/10.

## 10/10 er jonno egulo human/external action — code diye fake kora jabe na

Plain English / Bangla mix so it is unambiguous:

1. **Merge + deploy** — ei branch `main`-e na gele live site e P0 outbound persist thakbe na.
2. **Human staging capture** — screenshot/video code diye generate kora jabe na; fictional data diye manush capture korbe.
3. **30-day observation** — clock start + finish dated hote hobe. Age number publish kora jabe na.
4. **Independent pentest** — repo audit pentest noi.
5. **Staging restore drill / PITR** — operator run korbe; docs drill noi.
6. **Legal / DPDP** — lawyer/reviewer; agent complete korte pare na.
7. **Worker + cron running** — target environment-e process actually chalute hobe.
8. **3–5 real clinic pilots** — asol clinic name; invented name use kora jabe na.
9. **Branch protection + release SHA** — GitHub/org settings + post-deploy verify.
10. **Keyboard + mobile device audit** — authenticated device pass.

**Code diye 10/10 likhe dileo seta 10/10 noi.**

## Remaining risks

- P0 persist is not on `main` until this PR merges and deploys.
- Service-role APIs can regress isolation if a new handler skips session `account_id`.
- Worker absence stalls outbox reconcile; heartbeat reports `stale` only after this branch is deployed and the worker is running.
- No measured availability, delivery, or AI rates. Do not copy Target cells into Observed.
- Storage objects and provider subscriptions are outside Postgres backup.
- Rate limits / WAF are hosting-dependent.
- Healthcare claims remain legally uncertified (`SECURITY.md`).

## Safety confirmation

This pass **did not** weaken: RLS policies, webhook HMAC, encryption, role gates, rate limits, clinical/AI fail-closed paths, CI warning thresholds, or existing tests. Automations still insert via `src/lib/automations/automation-row.ts` (`insertAutomationRow`). Generated `src/lib/build-info.json` / `src/lib/build-metadata.json` were not committed.
