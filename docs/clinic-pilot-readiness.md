# Clinic pilot readiness (3–5 clinics)

**Status:** `CHECKLIST READY — NO PILOT CLINICS ENROLLED IN THIS REPO`  
Do not invent clinic names, logos, or outcomes. Use only real tenant records or the fictional demo clinic.

## Scope

A controlled pilot is a small set of named clinics that operators invite, configure, and support. This repository prepares identification and isolation checks. It does not enroll clinics.

## Tenant lifecycle audit (code)

| Area | Where | Notes |
| --- | --- | --- |
| Tenant creation | `getCurrentAccount` / onboard | First login can create a workspace; industry onboard seeds KB and automations via `insertAutomationRow` |
| Invitations | `/api/account/invitations` | `account_invitations`, role-gated |
| Roles | `src/lib/auth/roles.ts` | owner > admin > agent > viewer |
| WhatsApp | `/api/whatsapp/config`, Evolution/Meta/WAHA | Connection is tenant-scoped; disconnect/reconnect updates `whatsapp_configs` |
| AI | Account chatbot settings + conversation `ai_chat_enabled` | Staff can pause AI per conversation |
| Clinic info / KB | Settings + `knowledge_base` | Onboard replaces seeded titles only |
| Availability / doctors | `hospital_doctors` | Required for booking |
| Appointments | `/api/appointments` | Tenant `account_id` on insert |
| Automations | `/api/automations` + engine | `insertAutomationRow` + `created_by` |
| Isolation | RLS + `requireRole` | Service-role APIs must still filter `account_id` from session |
| Onboarding errors | Onboard API | Failures should not delete existing KB rows |
| Disconnect / reconnect | WhatsApp config | Status and last health check timestamps |

## Operator checklist (per clinic)

Copy one row per real clinic. Leave unused rows blank.

| Clinic (legal name) | Environment (staging/prod) | WhatsApp provider | Connected | Doctors | KB | Automations | Members | Invites pending | Dead-letter | Outbox failed | Blockers | Support owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | | | | | |
| | | | | | | | | | | | | |
| | | | | | | | | | | | | |
| | | | | | | | | | | | | |
| | | | | | | | | | | | | |

## In-product status

Admins can open **Settings → Overview**. The "Clinic readiness" card reads `GET /api/pilot/readiness` and shows clinic name, environment, WhatsApp connected flag (not the phone number), config counts, error counts, and blocker keys. Viewers do not receive this API (admin+).

The API never returns tokens, phone numbers, or patient names.

## Isolation checks before the first live patient

1. Two staging tenants; confirm inbox, appointments, and KB do not cross.
2. Invite a viewer and confirm they cannot send or mutate.
3. Disconnect WhatsApp and confirm send fails closed; reconnect and confirm health.
4. Pause AI on one conversation and confirm no auto-reply.
5. Confirm demo/synthetic accounts are listed in `HELPA_TEST_TENANT_IDS` or `DEMO_ACCOUNT_ID` so they do not enter the 30-day scorecard.

## Human-only items

- Written clinic consent and a support contact.
- Jurisdiction / DPDP / healthcare legal review.
- Live WhatsApp round-trip on the clinic's own number.
- Decision that the clinic will use staging or production.
