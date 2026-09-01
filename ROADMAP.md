# Helpa public roadmap

Helpa is focusing first on independent clinics and outpatient teams using WhatsApp for patient communication.

A roadmap item is complete only when it has evidence: passing tests, a deployed build, a dated report, or verified production measurements. Targets and mock data must never be presented as customer outcomes.

## Now — prove the clinic workflow

- [x] Prepare 7-shot capture checklist and 90s walkthrough specification (`docs/PRODUCT_DEMO.md`). _(Ready / awaiting human staging capture)_
- [x] Verify fictional demo fixtures cover inbound → availability → slot → booking → takeover → history (`src/lib/demo/patient-journey.ts`). _(Ready / awaiting live staging WhatsApp + screenshot capture)_
- [ ] Complete a real staging demo with seven fictional-data screenshots.
- [ ] Publish a captioned 90-second product walkthrough.
- [x] Instrument response time, bookings, automation success, reliability failures, and patient return hashing (`src/lib/metrics`, `docs/observability.md`).
- [x] Expose tenant-scoped aggregate observation API (`GET /api/metrics/observation`) that cannot publish a scorecard by itself.
- [ ] Complete 30-day production observation period before publishing scorecard.
- [x] Publish a 3–5 clinic pilot checklist and in-product readiness card (`docs/clinic-pilot-readiness.md`). _(Ready / awaiting real clinic enrollment)_
- [ ] Pilot with 3–5 clinics and document consented, anonymized outcomes.

## Next — reduce operational risk

- [x] Prepare independent security review handover package and remediation tracker (`docs/EXTERNAL_SECURITY_REVIEW_PACKAGE.md`, `docs/pentest-readiness.md`). _(Ready / awaiting assessor)_
- [ ] Commission third-party cybersecurity firm for formal penetration test and signed retest.
- [x] Inventory Appwrite assets and establish 10 cutover gates (`docs/APPWRITE_INVENTORY_AND_CUTOVER.md`).
- [ ] Execute irreversible Appwrite removal upon human cutover sign-off.
- [x] Write restore-testing procedure for staging/throwaway projects (`docs/operations/runbook-backup-restore.md`). _(Ready / awaiting operator drill)_
- [x] Write incident-response runbooks for six production scenarios (`docs/incident-response.md`). _(Ready / awaiting game day)_
- [x] Define SLO table with Target vs empty Observed (`docs/slo.md`).
- [ ] Fill Observed SLO cells from a dated production window.
- [x] Fix reception a11y labels (search, filters, AI pause, composer, appointment tabs) and mobile overflow on inbox/appointments routes. _(Ready / awaiting full keyboard and device pass)_
- [ ] Complete a human accessibility and mobile usability audit of the reception workflow.

## Later — expand carefully

- [ ] Add specialty-specific templates based on verified clinic demand.
- [ ] Re-evaluate non-clinic verticals only after the clinic onboarding and retention targets are met.
- [ ] Publish integrations and an extension model after core APIs stabilize.

## Decision gates

Complete = implemented **and** verified. Ready / awaiting external action = repo prepared, human or infra still required. Blocked = cannot proceed without an external dependency (assessor, clinic, legal, hosting).
