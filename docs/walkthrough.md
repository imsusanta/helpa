# Implementation Walkthrough

How the clinic vertical and the webhook pipeline were built. This is a
historical engineering narrative; for current structure see
[ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 1. Patient care pipeline (`034_hospital_pipeline_stages.sql`)

A migration replaced the generic CRM pipeline with a clinical pipeline ordered
by the real patient journey:

1. `New Inquiry`
2. `Appointment Requested`
3. `Appointment Confirmed`
4. `Visited`
5. `Treatment Ongoing`
6. `Follow-up`

Generic CRM components, sidebars, and overlays were redesigned to use
patient-care terminology driven by the active industry manifest.

---

## 2. Fail-closed security and a green CI gate

- **Webhook verification.** `POST /api/whatsapp/webhook` unconditionally
  rejects missing, tampered, or invalid signatures with `401 Unauthorized`
  and `{ error: 'Invalid webhook signature' }`.
- **No suppressed build errors.** Removed
  `typescript: { ignoreBuildErrors: true }` from `next.config.ts` and fully
  typed `NextConfig`.
- **Hook order fix.** Removed a conditional hook call in
  `src/app/(dashboard)/dashboard-shell.tsx`.
- **Lint and format alignment.** ESLint flat config plus Prettier applied
  repository-wide, with `--max-warnings=0` in CI.

---

## 3. Modular webhook architecture

The original 1,400-line webhook `route.ts` was decomposed into
single-responsibility modules under `src/app/api/whatsapp/webhook/`:

| Module | Responsibility |
| --- | --- |
| `route.ts` | Slim HTTP router (<95 lines) with fail-closed signature verification |
| `verify-request.ts` | Meta hub challenge, verify-token decryption, GCM migration |
| `types.ts` | Typed webhook payloads, messages, status updates, parsed content |
| `parse-event.ts` | Extracts text, image, audio, document, location, reaction, interactive |
| `contact-service.ts` | Contact deduplication and sequential patient ID assignment |
| `conversation-service.ts` | Conversation find/create and broadcast recipient sync |
| `process-reaction.ts` | Persists inbound emoji reactions in `message_reactions` |
| `process-status.ts` | Delivery ladder: `sent` → `delivered` → `read` → `replied` |
| `process-message.ts` | Message insert, appointment button handling, lab report actions, flow dispatch, AI trigger |
| `webhook.test.ts` | Signature rejection, valid acceptance, challenge validation |

---

## 4. Clinical surfaces

- **Patients** (`/patients`) — registration and directory over the shared
  contacts structure, with a details drawer showing demographics, blood group,
  emergency contacts, recent WhatsApp history, active appointments, and AI
  conversation summaries.
- **Appointments** (`/appointments`) — calendar tabs for upcoming, completed,
  and cancelled, with quick confirm and cancel actions.
- **Doctors** (`/doctors`) — on-shift practitioners, departments, shift times,
  consultation fees.
- **Departments** (`/departments`) — staffing levels and active booking counts
  per department.
- **Knowledge base** (`/knowledge-base`) — emergency numbers, guidelines, and
  fee FAQs used to ground AI replies.

---

## 5. Quality gates at the time of this work

| Gate | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | 0 errors |
| Typecheck | `npm run typecheck` | 0 errors |
| Format | `npm run format:check` | Clean |
| Unit & integration | `npm test` | All suites passing |
| Production build | `npm run build` | Success |

For current, reproducible numbers run the suites locally or read the latest CI
run rather than trusting counts recorded in documentation.
