# Helpa — AI Business Communication Platform & CRM

> Helpa answers your customers on WhatsApp 24/7, books appointments into a real
> calendar, and keeps every conversation, patient record, and follow-up in one
> multi-tenant CRM — built on the official Meta WhatsApp Business Cloud API.

<p align="center">
  <img src="./public/assets/helpa-hero.svg" alt="Helpa — AI Business Communication Platform" width="850">
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-emerald.svg" alt="License: MIT"></a>
  <a href="./CHANGELOG.md"><img src="https://img.shields.io/badge/Version-0.3.0-blue.svg" alt="Version 0.3.0"></a>
  <a href="https://github.com/imsusanta/helpa/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/imsusanta/helpa/ci.yml?branch=main&label=CI" alt="CI status"></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16.3-black?logo=nextdotjs" alt="Next.js 16.3"></a>
  <a href="https://supabase.com"><img src="https://img.shields.io/badge/Supabase-PostgreSQL%20%26%20Auth-3ECF8E?logo=supabase" alt="Supabase"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript" alt="TypeScript strict"></a>
</p>

---

## What it does

- **Never miss an enquiry.** An AI receptionist replies on WhatsApp instantly,
  at any hour, grounded in your own services, hours, and pricing.
- **Turn chats into bookings.** It checks real availability, prevents double
  booking, confirms over WhatsApp, and sends reminders before the appointment.
- **Keep the whole relationship in one place.** Unified team inbox, contact and
  patient records, pipelines, broadcasts, and automations — one workspace per
  business, strictly isolated from every other tenant.

**Live app:** <https://wacrm-susanta.vercel.app>

<!-- TODO(#84): embed the 90-second clinic demo GIF and product screenshots here, above the architecture details. -->

---

## Who it is for

| Vertical | What Helpa handles |
| --- | --- |
| 🏥 **Clinics & doctors** | Sequential patient IDs (`PT-XXXXXX`), doctor schedules, slot conflict prevention, HMAC-signed OPD slips with QR check-in, lab report dispatch and follow-up reminders |
| 🎓 **Coaching institutes** | 10-stage admission pipeline from enquiry to enrolled, course catalog, batch capacity, automated fee alerts |
| 📚 **Solo tutors** | Focused single-teacher workspace, multi-child parent resolution, 24 h and 2 h class reminders, homework and doubt tracking |
| 💇 **Salons & spas** | Treatment menus, live stylist availability, one-click reschedule, 30-day retention follow-ups |
| 🏢 **Real estate** | Sequential lead IDs (`LEAD-XXXXXX`), budget and requirement matching, site-visit booking with agent assignment |

The health vertical is the current production focus. The other four are
implemented against the same module contract and are architecture-ready.

---

## Security highlights

- **Fail-closed webhook verification.** Constant-time HMAC-SHA256 on
  `POST /api/whatsapp/webhook`; unsigned or tampered payloads are rejected
  before any database access.
- **Encrypted credentials at rest.** Meta tokens and third-party keys are
  sealed with AES-256-GCM authenticated encryption.
- **Strict multi-tenant isolation.** PostgreSQL row-level security plus
  server-side tenant guards on every mutation; `account_id` always comes from
  the verified session, never from the request.
- **Signed document access.** Appointment slips, invoices, and lab reports are
  served through short-lived HMAC tokens bound to resource, account, and expiry.
- **PII/PHI redaction.** The structured logger scrubs names, clinical notes,
  phone numbers, passwords, and bearer tokens from telemetry.
- **No shared-cache leakage.** Authenticated routes enforce
  `Cache-Control: private, no-store`.

Full detail: [threat model](./docs/security/threat-model.md) ·
[data security model](./docs/security/data-security-model.md) ·
[route security matrix](./docs/security/route-security-matrix.md)

> **Compliance status — read this before clinical use.** Helpa implements
> technical safeguards commonly expected under the India DPDP Act and the HIPAA
> Security Rule, but these controls are self-attested and have **not** been
> independently audited or certified. Running Helpa does not by itself make a
> deployment DPDP- or HIPAA-compliant. An independent security assessment is
> tracked in [#81](https://github.com/imsusanta/helpa/issues/81) and should be
> completed, along with appropriate infrastructure and a Business Associate
> Agreement where applicable, before storing live patient records.

---

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 ·
Supabase PostgreSQL + Auth with RLS · Meta WhatsApp Business Cloud API ·
provider-agnostic AI engine (OpenRouter / OrcaRouter) · Vitest · Playwright

Architecture overview: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

## Quick start

```bash
git clone https://github.com/imsusanta/helpa.git
cd helpa
npm ci
cp .env.local.example .env.local
npm run dev
```

Minimum environment configuration:

```env
AUTH_PROVIDER="supabase"
DATABASE_PROVIDER="supabase"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
ENCRYPTION_KEY="32_byte_hex_key"
WHATSAPP_APP_SECRET="your_meta_app_secret"
```

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for production deployment and
[docs/OPERATIONS.md](./docs/OPERATIONS.md) for runbooks.

### Quality gates

```bash
npm run format:check      # Prettier verification
npm run lint              # ESLint, zero warnings allowed
npm run typecheck         # TypeScript strict validation
npm test                  # Vitest unit and module suites
npm run test:integration  # Tenant isolation and security suites
npm run test:e2e          # Playwright end-to-end specs
npm run supabase:validate # Migration manifest validation
npm run build             # Production build
```

---

## Documentation

Everything lives in [`docs/`](./docs) — start with the
[documentation index](./docs/README.md).

| Area | Entry point |
| --- | --- |
| Architecture | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| Core platform boundaries | [docs/core-platform-architecture.md](./docs/core-platform-architecture.md) |
| AI engine | [docs/ai-provider-architecture.md](./docs/ai-provider-architecture.md) |
| Security | [docs/security/](./docs/security) |
| Testing | [docs/testing.md](./docs/testing.md) |
| Deployment & operations | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md), [docs/OPERATIONS.md](./docs/OPERATIONS.md) |
| Roadmap | [docs/10-OUT-OF-10-ROADMAP.md](./docs/10-OUT-OF-10-ROADMAP.md) |

---

## Project status

**Current release:** `v0.3.0` — see [CHANGELOG.md](./CHANGELOG.md).

Honest snapshot of what is still open:

| Area | Status | Tracking |
| --- | --- | --- |
| Supabase is the active database and auth provider | Cutover complete | — |
| Legacy Appwrite runtime still vendored for rollback | Removal pending | [#82](https://github.com/imsusanta/helpa/issues/82) |
| Independent security assessment | Not yet commissioned | [#81](https://github.com/imsusanta/helpa/issues/81) |
| Published outcome metrics | Not yet instrumented | [#83](https://github.com/imsusanta/helpa/issues/83) |
| Demo video and screenshots | Not yet published | [#84](https://github.com/imsusanta/helpa/issues/84) |

---

## Contributing & security

- Contribution workflow: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Vulnerability disclosure: [SECURITY.md](./SECURITY.md) — please report
  privately rather than opening a public issue.

---

## License & attribution

MIT — see [LICENSE](./LICENSE).

Helpa is developed by **Helpa Studio** and builds on the MIT-licensed
[wacrm](https://github.com/ArnasDon/wacrm) project by
[ArnasDon](https://github.com/ArnasDon). It extends that foundation with
multi-industry modules, Meta 1-click Embedded Signup, a super admin control
center, SaaS billing, security hardening, and clinical healthcare workflows.
