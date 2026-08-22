# Product outcomes

Helpa publishes outcomes only when they can be computed from production events. No sample or estimated values should be presented as customer results.

## North-star metrics

| Metric | Definition | Source event | Reporting window |
| --- | --- | --- | --- |
| Median first-response time | Median time from inbound patient message to first clinic or automated reply | inbound message + outbound message | Rolling 30 days |
| Bookings handled | Confirmed appointments whose journey began in WhatsApp | conversation attribution + appointment confirmed | Calendar month |
| Automation success rate | Eligible conversations completed without staff takeover or error | automation completed / eligible automation started | Rolling 30 days |
| Patient return rate | Patients with another completed visit within 90 days | completed appointments, deduplicated by patient | Rolling cohort |

## Versioned event contract

Migration `20260822131500_product_outcome_events.sql` defines the first privacy-safe event contract. It records only allowlisted event names, an explicit schema version, an opaque idempotency identifier, synthetic/test flags, and optional one-way subject hashes.

Raw events are server-only. Anonymous and authenticated clients cannot read or write the table. Attributes reject common direct-identifier keys, but producers must still avoid patient content and use opaque source identifiers.

The contract is measurement infrastructure, not outcome evidence. Publication remains blocked until producers are connected, calculations are validated against the manual sample, consent is recorded, and 30 complete production days are available.

## Publication rules

1. Exclude test tenants, synthetic traffic, retries, and duplicate webhooks.
2. Display the observation window and eligible sample size beside every number.
3. Separate automated replies from human replies.
4. Do not call patient return rate “retention” until identity resolution and visit completion are reliable.
5. Suppress small cohorts that could expose sensitive information.
6. Have a named owner sign off on each public update.

## Initial target ranges

Targets are goals, not current results:

- Median first response: under 60 seconds for automation-eligible messages.
- Booking completion: establish baseline before setting a target.
- Automation success: at least 80% for supported intents, with safe staff handoff.
- Patient return rate: baseline by clinic type; never aggregate incompatible specialties.

## Launch checklist

- [x] Define and test the versioned, de-identified source-event contract.
- [ ] Connect production event producers without patient content.
- [ ] Validate calculations against a manual 100-conversation sample.
- [ ] Obtain clinic consent for anonymized aggregate reporting.
- [ ] Publish the first dated scorecard after 30 complete production days.
