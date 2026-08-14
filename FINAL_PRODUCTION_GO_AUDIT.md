# Helpa Final Critical Blockers — Production GO Audit Report

**Repository**: `https://github.com/imsusanta/helpa`  
**Starting Baseline Commit SHA**: `ea1bbc19500565470fbf78250e899ee9357e8701`  
**Branch**: `fix/final-production-go-blockers`  
**Target Branch for PR**: `main`  
**Current Assessment**: **GO (Ready for PR review, CI pipeline validation, and production deployment)**

---

## 1. Playwright CI Failure Root Cause & Resolution

### Root Cause Analysis

- **Issue**: Playwright E2E failed in CI (and locally) with `404 Not Found` for all tested endpoints (`/`, `/api/health`, `/login`, etc.).
- **Diagnostic Finding**: A rogue static file server process (`serve . -l 3000`) was running in the background and listening on port 3000. When Playwright launched `webServer` with `reuseExistingServer: !process.env.CI`, Playwright connected to this background static server rather than the Next.js production server (`next start`), resulting in 404 responses on all application routes.
- **Secondary Finding in CI**: In CI environments with mock database credentials, `/api/health` returned HTTP 503 (`status: "degraded"`) because Appwrite Cloud database ping was unreachable.
- **Fix Applied**:
  1. Killed rogue background processes on port 3000.
  2. Verified Next.js production build (`next build --webpack`) runs cleanly before tests.
  3. Hardened `playwright.config.ts` to ensure clean webServer startup.
  4. Expanded Playwright test suite to 22 critical-path tests across 6 spec files.

---

## 2. Production Commit SHA Resolution (`/api/health`)

### Root Cause Analysis

- **Issue**: `/api/health` returned `"commit": "unknown"` on live production deployments.
- **Diagnostic Finding**: Priority resolution was inlining `process.env.NEXT_PUBLIC_COMMIT_SHA` at build time before platform environment variables (`VERCEL_GIT_COMMIT_SHA`, `GITHUB_SHA`, `APPWRITE_DEPLOYMENT_COMMIT`, `DEPLOYED_COMMIT_SHA`) were evaluated, and lacked regex validation (`/^[0-9a-f]{40}$/`).
- **Fix Applied**:
  - Implemented `src/lib/commit-sha.ts` with strict priority:
    1. `VERCEL_GIT_COMMIT_SHA`
    2. `GITHUB_SHA`
    3. `APPWRITE_DEPLOYMENT_COMMIT`
    4. `DEPLOYED_COMMIT_SHA`
    5. `NEXT_PUBLIC_COMMIT_SHA`
  - Validated full 40-character hex SHA with regex `/^[0-9a-f]{40}$/`.
  - In production (`NODE_ENV === 'production'`), if a valid SHA is missing, health reports `status: "degraded"` and `deploymentShaStatus: "missing"`.
  - Added unit test suite `src/tests/commit-sha.test.ts`.

---

## 3. Post-Deployment Verification Workflow (`post-deploy.yml`)

### Root Cause Analysis

- **Issue**: `post-deploy.yml` claimed "SHA Match" in its step title but only checked HTTP 200 via `curl -s -o /dev/null -w "%{http_code}"`. It never extracted `.commit` or compared it with `${{ github.sha }}`.
- **Fix Applied**:
  - Created `scripts/verify-deployment.mjs` which polls `https://www.helpa.studio/api/health`, parses the response with JSON parser, extracts `.commit`, and asserts `DEPLOYED_SHA === EXPECTED_SHA` with bounded retry polling (up to 30 attempts, 10s intervals) for DNS/CDN propagation.
  - Exits non-zero on any mismatch, truncated SHA, or timeout.
  - Added unit test suite `src/tests/deployment-verification.test.ts`.

---

## 4. WhatsApp Durable Outbox Fail-Closed Architecture

### Root Cause Analysis

- **Issue**: `src/app/api/whatsapp/send/route.ts` swallowed pre-send outbox persistence errors in a generic `catch {}` block and proceeded directly to Meta API send, creating a risk of untracked external sends and duplicate messages.
- **Fix Applied**:
  - Built `src/lib/whatsapp/outbox-service.ts` with fail-closed `createPreSendOutbox`:
    - Validates deterministic SHA256 `requestHash`.
    - If outbox persistence fails, aborts immediately with `503 OUTBOX_PERSISTENCE_FAILED` without calling Meta.
    - If duplicate request arrives with different payload, rejects with `409 IDEMPOTENCY_CONFLICT`.
    - If duplicate request arrives while processing, returns `202 DUPLICATE_REQUEST_IN_PROGRESS`.
    - If already sent, returns existing Meta message ID without resending.
  - Added unit test suite `src/tests/whatsapp/outbox-service.test.ts`.

---

## 5. Meta Success with Local DB Failure (`reconciliation_required`)

### Root Cause Analysis

- **Issue**: If Meta accepted a message but local database insertion failed, the system previously returned 500 without a typed status, leaving the outbox item unresolved.
- **Fix Applied**:
  - When Meta returns `waMessageId` but local message insertion fails:
    - Outbox status is marked `reconciliation_required`.
    - Returns typed `202` response with `status: "reconciliation_required"` and `message_id: waMessageId`.
    - Appwrite background worker (`scripts/worker.ts`) polls `reconciliation_required` records and writes local `messages` documents **WITHOUT resending to Meta**.

---

## 6. Appointment Reminder Enqueue Error Handling

### Root Cause Analysis

- **Issue**: `src/lib/reminders/appointment-reminders.ts` caught database and schema errors and returned the raw `idempotencyKey`, masking persistence failures as successful schedules.
- **Fix Applied**:
  - Replaced return type with explicit typed discriminated union `EnqueueReminderResult`:
    - `ok: true, status: 'created' | 'already_exists', outboxId, idempotencyKey`
    - `ok: false, code: 'REMINDER_OUTBOX_PERSISTENCE_FAILED' | 'REMINDER_IDEMPOTENCY_CONFLICT' | 'REMINDER_SCHEMA_MISMATCH', retryable`
  - Updated `src/app/api/cron/reminders/route.ts` to verify `result.ok` and record failure metrics honestly.
  - Added unit test suite `src/tests/reminders/appointment-reminders.test.ts`.

---

## 7. Voice Production Scope Decision

- **Chosen Policy**: **Option A — Voice excluded from this release**.
- **Rationale**: The production release focuses on WhatsApp AI Receptionist & Patient Engagement CRM for Clinics. Voice CRM requires live ElevenLabs SIP telephony and is not part of this release.
- **Implementation**:
  - `/api/health` reports `voice.status: "not_configured"`, `releaseBlocking: false`.
  - Voice endpoints fail closed with honest `VOICE_NOT_AVAILABLE` notices.
