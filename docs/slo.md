# Production SLO / reliability reporting

**Status:** `TARGETS DEFINED — OBSERVED RESULTS EMPTY`  
This file does not contain production measurements.

## How to read this table

- **Target / SLO** is an operational goal. It is justified only where the product already has a fail-closed path and a measurement hook.
- **Observed** is blank until a dated production window is collected. Do not copy targets into customer materials.

| Indicator | Definition | Target / SLO | Observed (production) | Source |
| --- | --- | --- | --- | --- |
| Availability | `/api/health/ready` returns 200 | 99.5% monthly once a probe is scraped externally | *Not collected* | Ready probe + host metrics |
| API error rate | 5xx / total authenticated API requests | Establish baseline in first 30 days | *Not collected* | Platform logs (operator) |
| Webhook success | Inbound persist without `webhook_failed` | ≥ 99% of accepted, signature-valid deliveries | *Not collected* | `product_outcome_events` |
| Webhook latency | Time from provider POST to persist | Baseline first; no target until measured | *Not collected* | Provider + app logs |
| Outbound success | Persist after provider accept | ≥ 99% when provider accepts | *Not collected* | Outbox + `outbound_message_sent` |
| Inbound success | Persist of valid individual chats | ≥ 99% of valid individual inbound | *Not collected* | `inbound_message_received` |
| Delivery failures | Failed WhatsApp status | Baseline first | *Not collected* | `message_delivery_failed` |
| AI failure | `triggerAiResponse` throws | Baseline first; staff handoff remains required | *Not collected* | `ai_failed` |
| Appointment success | Booking insert succeeded | Baseline first | *Not collected* | `booking_confirmed` |
| Automation success | completed / eligible | 80% for supported intents after cohort ≥ 10 | *Not collected* | Automation events |
| Worker / queue | Heartbeat age ≤ 90s | Worker `ok` while `npm run worker` is required | *Not collected* | `operational_heartbeats` |
| DB errors | Health database check | Ready probe fails closed (503) | *Not collected* | `/api/health/ready` |

## Justified targets only

- **Ready probe 503 on DB failure** is implemented and tested. The 99.5% availability number is a goal for an external probe, not a measured result.
- **Automation 80%** matches the existing product-metrics goal. It is a goal, not a result.
- Delivery, AI, appointment, and API error rates have **no numeric target** until a baseline exists.

## Reporting rules

1. Separate Target from Observed in every scorecard.
2. Show window dates and eligible sample size.
3. Suppress cohorts under 10.
4. Exclude `is_synthetic` and `is_test_tenant`.
5. Never publish an Observed cell from this file until operators fill it from production events.
