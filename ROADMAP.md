# Helpa public roadmap

Helpa is focusing first on independent clinics and outpatient teams using WhatsApp for patient communication.

## Now — prove the clinic workflow

- [x] Prepare 7-shot capture checklist and 90s walkthrough specification (`docs/PRODUCT_DEMO.md`). *(Awaiting human staging capture)*
- [ ] Complete a real staging demo with seven fictional-data screenshots.
- [ ] Publish a captioned 90-second product walkthrough.
- [x] Instrument response time, bookings handled, automation success, and patient return rate (`src/lib/metrics`).
- [ ] Complete 30-day production observation period before publishing scorecard.
- [ ] Pilot with 3–5 clinics and document consented, anonymized outcomes.

## Next — reduce operational risk

- [x] Prepare independent security review handover package and remediation tracker (`docs/EXTERNAL_SECURITY_REVIEW_PACKAGE.md`).
- [ ] Commission third-party cybersecurity firm for formal penetration test and signed retest.
- [x] Inventory Appwrite assets and establish 10 cutover gates (`docs/APPWRITE_INVENTORY_AND_CUTOVER.md`).
- [ ] Execute irreversible Appwrite removal upon human cutover sign-off.
- [ ] Add restore testing, incident-response exercises, and production SLO reporting.
- [ ] Add accessibility and mobile usability audits for the reception workflow.

## Later — expand carefully

- [ ] Add specialty-specific templates based on verified clinic demand.
- [ ] Re-evaluate non-clinic verticals only after the clinic onboarding and retention targets are met.
- [ ] Publish integrations and an extension model after core APIs stabilize.

## Decision gates

A roadmap item is complete only when it has evidence: passing tests, a deployed build, a dated report, or verified production measurements. Targets and mock data must never be presented as customer outcomes.
