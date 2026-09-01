# Production observation (30-day window)

**Status:** `READY TO COLLECT — OBSERVATION PERIOD NOT STARTED`  
**Does not claim:** a completed 30-day window, published scorecard, or production outcomes.

This document describes how Helpa can observe production safely. It is measurement infrastructure, not evidence that observation has occurred.

## What is measured

| Indicator | Event names | Calculation | Success | Failure |
| --- | --- | --- | --- | --- |
| First response time | `inbound_message_received`, `first_response_sent` | Persist-time `response_time_seconds` when available; otherwise pair inbound + first-response by conversation id (no PII). Median + automated vs human counts | Median computed and sample ≥ 10 | Missing pairable events or cohort < 10 (suppressed) |
| Successful conversations / bookings | `booking_confirmed` | Confirmed bookings; WhatsApp-attributed when `channel=whatsapp` | Count of eligible bookings | Cohort < 10 (suppressed) |
| Appointment success | `booking_confirmed`, `appointment_completed` | Completions vs confirmations when both exist | Completion events recorded | Completions not yet produced from visit workflows |
| Automation success | `automation_eligible`, `automation_completed`, `staff_takeover`, `automation_error` | completed / eligible | Rate computed, sample ≥ 10 | Errors, takeovers, or suppressed cohort |
| Message delivery failures | `message_delivery_failed`, `outbound_message_sent` | failures / (inbound + outbound) | Rate after cohort floor | Failed WhatsApp status |
| Webhook failures | `webhook_failed` | Count + rate vs message attempts | Persist succeeded | Inbound persist failed |
| AI failures | `ai_failed` | Count + rate vs message attempts | AI trigger succeeded | `triggerAiResponse` threw |
| Worker / queue | `operational_heartbeats` + `worker_failed` when tenant-scoped | Heartbeat age ≤ 90s is `ok` | Worker loop completed | Heartbeat stale or error status |
| DB / app availability | `/api/health`, `/api/health/ready` | Reachable profiles + SHA | `status=ok` and ready 200 | `degraded` / ready 503 |
| Integration failures | `integration_failed` | Count | Provider call succeeded | Recorded only when a tenant-scoped producer emits it |
| Patient return | `appointment_completed`, `patient_return_completed` | Unique `subject_hash` with a later return event | Rate after cohort floor | Identity hash missing or cohort < 10 |

Uptime is **not** stored as a tenant event. Use platform health probes and the host uptime product. Do not invent an SLO result from an empty table.

## Privacy and tenancy

- Table: `product_outcome_events` (migration `20260822131500`, event names extended in `20260901060000`).
- Allowlisted event names only. Unique `(account_id, event_name, event_version, source_id)`.
- Attributes reject common identifier keys. Producers must not put names, phones, emails, or message text in `source_id` or `attributes`.
- `subject_hash` is a 64-character SHA-256. Raw patient IDs are hashed server-side.
- RLS is forced. `anon` and `authenticated` have no grants. Service-role only.
- Demo/test traffic is flagged (`DEMO_MODE`, `DEMO_ACCOUNT_ID`, `HELPA_TEST_TENANT_IDS`) and excluded from publication calculations.
- `GET /api/metrics/observation` is session-scoped to the caller's `accountId`. It returns aggregates only. It never returns raw events.

## How to start and evaluate a 30-day period

1. Confirm producers are deployed and `OUTCOME_METRICS_PEPPER` (or `META_APP_SECRET`) is set in production.
2. Record the **actual** first eligible production event date. Do not backdate.
3. Leave the window closed until `elapsedDays >= 30` **and** each published metric meets the cohort floor (10).
4. `generateObservationReadinessReport` and `/api/metrics/observation` stay `BLOCKED_BY_OBSERVATION_WINDOW` until those conditions hold.
5. Publication still requires: consent, a manual sample check, exclusion of synthetic traffic, and a named operator sign-off (`docs/PRODUCT_METRICS.md`).

**Current evaluation:** no production observation start date is recorded in this repository. `isProductionObservationComplete` must be treated as false until operators record a start date and 30 complete days exist.

## Operator checks

- `GET /api/health` — app, database, auth configured, worker heartbeat (no secrets).
- `GET /api/metrics/observation` — tenant aggregates; `publication.allowed` is always false until human publication rules are met.
- Heartbeat table `operational_heartbeats` is service-role only and must not store tokens or patient data.
