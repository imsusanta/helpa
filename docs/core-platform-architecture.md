# Helpa Core Platform Architecture

**Architecture style:** modular monolith with clean service boundaries
**Dependency rule:** `industry modules → core platform`. Core never imports an industry module.

---

## 1. Overview

Helpa splits cleanly into two layers:

1. **Core platform (`src/core/`)** — shared, industry-agnostic infrastructure:
   messaging, AI engine, multi-tenancy, and communication tooling.
2. **Industry modules (`src/modules/`)** — business-specific manifests,
   terminology, entities, workflows, campaign templates, and dashboards
   (health, coaching, solo tutor, salon, real estate).

```
                         HELPA
                           │
                     CORE PLATFORM
                           │
       ┌──────────┬────────┼────────┬──────────┐
    WhatsApp    Inbox      AI     Contacts   Knowledge
       └──────────┴────────┼────────┴──────────┘
                           │
                    Shared services
                           │
       ┌──────────┬────────┼────────┬──────────┐
     Health    Coaching  Tutor    Salon   Real Estate
```

---

## 2. Core services

| # | Module | Responsibility |
| --- | --- | --- |
| 1 | `src/core/auth/` | Signup, sign-in, session management, CSRF protection, role resolution |
| 2 | `src/core/tenants/` | Tenant boundary verification (`assertTenantMatch`, `validateTenantPayload`); every query scoped to `account_id` |
| 3 | `src/core/workspace/` | Business container: name, owner, country, timezone, business hours, logo, settings |
| 4 | `src/lib/whatsapp/` | Meta Embedded Signup with coexistence (`sessionInfoVersion: 3`), webhook routing via `phone_number_id`, inbound/outbound processing, delivery and read receipts |
| 5 | `src/core/inbox/` | Conversation threads with `open`/`closed`/`archived` status, AI auto-reply vs. human takeover, internal notes, tagging, assignment |
| 6 | `src/core/contacts/` | E.164 phone normalization, deduplication, custom metadata |
| 7 | `src/core/ai/` | `AiProvider` abstraction, manifest-driven system prompts, safety sanitization, prompt-injection detection |
| 8 | `src/core/ai/memory.ts` | Tenant-isolated sliding context window over recent messages and notes |
| 9 | `src/core/knowledge/` | Tenant-scoped FAQs, services, pricing, policies; keyword relevance matching and prompt injection of context |
| 10 | `src/core/copilot/` | Staff assistance: conversation summarization, intent detection, draft replies |
| 11 | `src/core/campaigns/` | Tag-segmented WhatsApp broadcasts with sent/delivered/read/failed metrics |
| 12 | `src/core/automations/` | Trigger → condition → action workflow execution |
| 13 | `src/core/notifications/` | Unified WhatsApp and in-app notification dispatch |
| 14 | `src/core/events/` | Async pub/sub bus (`message.received`, `contact.created`, `booking.created`) so modules subscribe without tight coupling |
| 15 | `src/core/permissions/` | Central `ROLE_PERMISSIONS` registry for `owner`, `admin`, `staff`, `viewer` |
| 16 | `src/core/analytics/` | Shared metrics: conversations, message volume, AI resolution rate, contact acquisition |

---

## 3. Data ownership

| Layer | Domain | Tables |
| --- | --- | --- |
| Core | Users, workspaces, memberships | `users`, `accounts`, `account_memberships` |
| Core | Contacts & conversations | `contacts`, `conversations`, `messages` |
| Core | WhatsApp integration | `whatsapp_config`, `whatsapp_templates` |
| Core | Knowledge base | `knowledge_base`, `kb_categories` |
| Core | Campaigns & automations | `broadcast_campaigns`, `automations` |
| Industry — Health | Clinical records | `patients`, `doctors`, `appointments`, `lab_reports` |
| Industry — Coaching | Academy records | `courses`, `batches`, `admissions` |
| Industry — Salon | Salon records | `services`, `staff`, `salon_appointments` |
| Industry — Real estate | Property records | `properties`, `agents`, `site_visits` |

---

## 4. Adding an industry module

1. Create a manifest under `src/modules/<vertical>/` describing terminology,
   navigation, dashboard cards, and entities.
2. Register it in `src/modules/registry.ts`.
3. Subscribe to core events rather than importing core internals directly.
4. Add vertical-specific AI tools through the core tool registry.
5. Add a module test suite under `src/tests/`.

No change to core code should be required to add a vertical. If it is, the
boundary is in the wrong place.
