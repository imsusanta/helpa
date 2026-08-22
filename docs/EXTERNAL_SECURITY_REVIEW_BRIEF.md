# External security review brief

## Objective

Commission an independent assessment before Helpa markets itself as compliant with HIPAA, India’s DPDP Act, or any equivalent healthcare regulation.

## Scope

- Authentication, session management, RBAC, and multi-tenant isolation.
- Supabase RLS policies, service-role usage, migrations, and backup access.
- Meta WhatsApp OAuth, webhook signature verification, replay protection, and token storage.
- AI prompt/data handling, provider retention, redaction, and unsafe output handling.
- Appointment, OPD, report, invoice, and signed-download authorization.
- Billing webhooks and privilege boundaries.
- CI/CD, dependency, secret, and production configuration review.
- Logging, incident response, deletion, export, and data-retention controls.

## Deliverables

1. Threat model and architecture review.
2. Authenticated web application and API penetration test.
3. Tenant-isolation test using at least two controlled tenants.
4. Findings with severity, evidence, remediation, and retest status.
5. Executive letter stating scope and dates—not a blanket compliance certificate.

## Vendor requirements

- Independent from the implementation team.
- Demonstrated SaaS and healthcare-data experience.
- Safe-harbor and disclosure process agreed before testing.
- Test only staging unless production testing is explicitly approved.
- Delete assessment data after the agreed retention period.

## Claim policy until completion

Use “designed with security controls for sensitive workflows.” Do not use “HIPAA compliant,” “DPDP certified,” “enterprise-grade security,” or uptime guarantees without auditable evidence and legal review.
