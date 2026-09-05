# Onboarding Architecture & Completion Contract Proof Report

**Date:** 2026-09-05  
**Branch:** `fix/onboarding-entry-point` (PR #252)  
**Database Engines Tested:** PostgreSQL 16.15 (Standalone Proof DB & Full 76-Table Repository DB)  
**Scope:** Authorized branch code changes and disposable local database testing ONLY. No production data modified.

---

## 1. Executive Summary

This report documents the executable proof, architecture, and verification of the new onboarding completion contract for Helpa.

The prior architecture relied on a weak, indirect heuristic (`accounts.welcome_message IS NOT NULL`) to determine onboarding completion. This heuristic failed because:
1. Valid setups could omit a custom welcome message.
2. The field was written prematurely before subsequent helper writes completed.
3. Later initialization failures left workspaces in a corrupted partial state while falsely signaling completion.
4. `accounts.status` represents operational/subscription standing (`DEFAULT 'active'`), not onboarding completion.

The revised architecture introduces an authoritative, server-controlled contract:
- **Truthful Columns on `public.accounts`:**
  - `onboarding_completed_at timestamptz DEFAULT NULL`: Truthful completion timestamp (never faked for legacy accounts).
  - `onboarding_exempted_at timestamptz DEFAULT NULL`: Server-controlled exemption timestamp for pre-contract legacy accounts.
  - `onboarding_exemption_reason text DEFAULT NULL`: Audit trail (`legacy_account_pre_contract`).
- **Durable Cutoff Guard (`public.migration_onboarding_guard`):** Persists `deployment_cutoff = clock_timestamp()` exactly once upon initial migration execution. Migration reruns read the immutable cutoff and never exempt newly created accounts.
- **Fail-Closed Field Protection (`tr_protect_account_onboarding_fields`):**
  - Trigger blocks direct `INSERT` or `UPDATE` of protected onboarding columns from untrusted roles (`anon`, `authenticated`), missing claims, or non-superuser clients with SQLSTATE `42501`.
  - Legitimate user profile edits (such as updating workspace `name`, `logo`, or settings) proceed without interference.
- **Single-Transaction Atomic RPC (`complete_workspace_onboarding`):**
  - Acquires an account-scoped row lock (`FOR UPDATE`) on `public.accounts`.
  - Re-evaluates eligibility under lock: if already completed or exempted, safely returns `{ success: true, status: 'already_completed', mutated: false }`.
  - Atomically applies all helper writes:
    - Account profile update (`name`, `industry`, `ai_system_prompt`, `welcome_message`, `status = 'active'`).
    - Module activation (`tenant_modules`).
    - Sales pipeline and stages (`pipelines`, `pipeline_stages`).
    - Custom services & company hours in Knowledge Base (`knowledge_base`), preserving existing FAQs.
    - Default campaign templates (`broadcasts`), preserving user draft campaigns.
    - Seeded automations and steps (`automations`, `automation_steps`) tagged with `metadata->>'helpa_seeded_workflow' = 'true'`, preserving user custom workflows.
    - Final atomic completion marker: stamps `onboarding_completed_at = clock_timestamp()`.
  - If any initialization step fails, the entire transaction rolls back completely (zero partial writes).

---

## 2. Reproduction & Execution Instructions

### A. Standalone Disposable Proof Execution
Runs against a fresh, disposable database `helpa_onboarding_proof_db`:
```bash
# 1. Create disposable database
createdb helpa_onboarding_proof_db

# 2. Run standalone proof SQL with ON_ERROR_STOP=1
psql -h 127.0.0.1 -d helpa_onboarding_proof_db -v ON_ERROR_STOP=1 -f docs/audits/onboarding-architecture-proof/onboarding-proof.sql

# 3. Run the automated test runner (50 assertions)
node docs/audits/onboarding-architecture-proof/test-onboarding-proof.mjs
```

### B. Repository Schema Integration Execution
Runs against the full 76-table real repository schema (`helpa_repo_test_db`):
```bash
# 1. Create disposable repo test database
createdb helpa_repo_test_db

# 2. Apply canonical complete schema and incremental migration
psql -h 127.0.0.1 -d helpa_repo_test_db -v ON_ERROR_STOP=1 -f scripts/supabase_schema_complete.sql
psql -h 127.0.0.1 -d helpa_repo_test_db -v ON_ERROR_STOP=1 -f supabase/migrations/20260905120000_onboarding_completion_contract.sql

# 3. Run the repository schema integration test runner (42 assertions)
node scripts/verify-onboarding-contract-repo-db.mjs
```

---

## 3. Execution Results & Assertions

### Standalone Proof Output (`test-onboarding-proof.mjs`)
```
====================================================
RUNNING ONBOARDING ARCHITECTURE PROOF (LOCAL PG 16)
====================================================

--- 1. Testing Cohorts & Migration Rerun Safety ---
✅ PASS: Found 2 legacy accounts
✅ PASS: Legacy Alpha has onboarding_exempted_at
✅ PASS: Legacy Alpha onboarding_completed_at is truthfully NULL
✅ PASS: Legacy Alpha exemption reason is legacy_account_pre_contract
✅ PASS: New Account Gamma onboarding_exempted_at = NULL
✅ PASS: New Account Gamma onboarding_completed_at = NULL
Re-running migration script with durable cutoff guard...
✅ PASS: Migration rerun executed successfully
✅ PASS: Gamma remains strictly UNEXEMPTED after migration rerun
✅ PASS: Gamma remains uncompleted after migration rerun
✅ PASS: Cohort 3 Account Theta onboarding_exempted_at = NULL
✅ PASS: Cohort 3 Account Theta onboarding_completed_at = NULL
Re-running migration script second time (rerun 2)...
✅ PASS: Migration rerun 2 executed successfully
✅ PASS: Cohort 1 Alpha retains original exemption timestamp across multiple reruns
✅ PASS: Cohort 2 Gamma remains UNEXEMPTED across multiple reruns
✅ PASS: Cohort 3 Theta remains UNEXEMPTED across multiple reruns

--- 2. Testing Field Protection & PostgREST Simulation ---
✅ PASS: Direct UPDATE of onboarding_completed_at by authenticated role blocked (42501)
✅ PASS: Direct UPDATE of onboarding_exempted_at by anon role blocked (42501)
✅ PASS: Direct INSERT with onboarding_completed_at by authenticated role blocked (42501)
✅ PASS: Direct INSERT with onboarding_exempted_at by anon role blocked (42501)
✅ PASS: Legitimate signup account creation without onboarding fields succeeds
✅ PASS: Direct RPC invocation of complete_workspace_onboarding by authenticated role blocked (permission denied)
✅ PASS: Direct RPC invocation of complete_workspace_onboarding by anon role blocked (permission denied)
✅ PASS: Direct UPDATE with missing JWT claims fails closed (42501)
✅ PASS: Legitimate account name update by authenticated user succeeds
✅ PASS: Authorized service_role can update onboarding fields

--- 3. Testing Single-Transaction RPC & Rollback ---
✅ PASS: Simulated initialization failure throws exception
✅ PASS: Atomic Rollback: onboarding_completed_at is still NULL
✅ PASS: Atomic Rollback: account industry was rolled back
✅ PASS: Atomic Rollback: 0 tenant modules written
✅ PASS: Atomic Rollback: 0 pipelines written
✅ PASS: Atomic Rollback: 0 automations written
✅ PASS: RPC returned success: true
✅ PASS: RPC returned status: "completed"
✅ PASS: RPC returned mutated: true
✅ PASS: Delta has valid onboarding_completed_at timestamp
✅ PASS: Delta name was updated
✅ PASS: Delta industry was updated
✅ PASS: Custom service was written to knowledge_base
✅ PASS: Tenant module was enabled
✅ PASS: Retry returned success: true
✅ PASS: Retry returned status: "already_completed"
✅ PASS: Retry returned mutated: false
✅ PASS: No duplicate knowledge base entries created on retry
✅ PASS: No duplicate pipelines created on retry

--- 4. Testing Concurrent Submissions Safety ---
✅ PASS: Exactly ONE concurrent submission executed the initialization mutations
✅ PASS: The other concurrent submission safely returned already_completed with mutated=false

--- 5. Testing Preservation of User Content ---
✅ PASS: User-created draft broadcast was 100% PRESERVED
✅ PASS: User-created draft broadcast status intact
✅ PASS: User-created custom FAQ was 100% PRESERVED
✅ PASS: User FAQ content intact

====================================================
PROOF EXECUTION SUMMARY: 50 PASSED, 0 FAILED
====================================================
```

### Full Repository Schema Output (`verify-onboarding-contract-repo-db.mjs`)
```
================================================================
VERIFYING ONBOARDING COMPLETION CONTRACT ON REPOSITORY SCHEMA
Database: helpa_repo_test_db (PostgreSQL 16)
================================================================

--- 1. Verifying Schema Invariants ---
✅ PASS: migration_onboarding_guard table exists with row id=1
✅ PASS: deployment_cutoff timestamp is persisted
✅ PASS: accounts table contains all 3 onboarding tracking columns
✅ PASS: complete_workspace_onboarding RPC exists with SECURITY DEFINER

--- 2. Verifying Fail-Closed Field Protection ---
✅ PASS: New signup account has onboarding_completed_at = NULL
✅ PASS: New signup account has onboarding_exempted_at = NULL
✅ PASS: New signup account status = active (operational standing)
✅ PASS: Untrusted authenticated role UPDATE of onboarding_completed_at blocked by trigger (42501)
✅ PASS: Untrusted authenticated role UPDATE of onboarding_exempted_at blocked by trigger (42501)
✅ PASS: Missing JWT claims with authenticated role blocked by trigger (42501)
✅ PASS: Anon role cannot touch any account rows (RLS blocks row access)
✅ PASS: Direct RPC call by authenticated role blocked
✅ PASS: Legitimate account profile update (name) by authenticated role allowed

--- 3. Testing Single-Transaction Atomic RPC on Real Schema ---
✅ PASS: Pre-seeding user draft broadcast succeeds
✅ PASS: Pre-seeding user custom FAQ succeeds
✅ PASS: RPC returned success = true
✅ PASS: RPC returned status = "completed"
✅ PASS: RPC returned mutated = true
✅ PASS: RPC returned truthful completed_at timestamp
✅ PASS: Account name updated to Apollo Healthcare Clinic
✅ PASS: Account industry updated to hospital_clinic
✅ PASS: Account status preserved as active
✅ PASS: Account has onboarding_completed_at set
✅ PASS: Account onboarding_exempted_at remains NULL (truthful)
✅ PASS: tenant_modules for hospital_clinic enabled
✅ PASS: Sales pipeline created
✅ PASS: All 3 pipeline stages created in same transaction
✅ PASS: Pre-existing user custom FAQ was PRESERVED
✅ PASS: New custom pricing FAQ seeded
✅ PASS: New clinic hours FAQ seeded
✅ PASS: Pre-existing user draft broadcast was PRESERVED
✅ PASS: New campaign template seeded
✅ PASS: Automations created in same transaction
✅ PASS: Automation seeded with helpa_seeded_workflow provenance tag
✅ PASS: Automation step created in same transaction

--- 4. Testing Lost-Response / Idempotent Retry ---
✅ PASS: Retry returned success = true
✅ PASS: Retry returned status = "already_completed"
✅ PASS: Retry returned mutated = false (no mutations replayed)
✅ PASS: No duplicate knowledge base entries created on retry
✅ PASS: No duplicate automations created on retry

--- 5. Testing Concurrent Submissions Safety on Repo DB ---
✅ PASS: Concurrent execution: Exactly 1 transaction acquired lock and mutated
✅ PASS: Concurrent execution: The other transaction returned already_completed with mutated=false

================================================================
REPO DATABASE VERIFICATION SUMMARY: 42 PASSED, 0 FAILED
================================================================
```

---

## 4. Rollout Cohort Policy & Migration Safety

| Cohort | Definition | Database State | Behavior & User Experience |
|---|---|---|---|
| **Cohort A (Pre-Cutoff Legacy)** | Accounts created on or before `deployment_cutoff` (`created_at <= deployment_cutoff`) | `onboarding_exempted_at = v_exempted_at`, `onboarding_completed_at = NULL`, `onboarding_exemption_reason = 'legacy_account_pre_contract'` | Bypass onboarding wizard immediately. Retain full access to settings, dashboard, and existing data. No destructive re-initialization. |
| **Cohort B (Cutoff-to-Deployment Window)** | Accounts created during deployment window after migration runs but before frontend code activates | `onboarding_exempted_at = NULL`, `onboarding_completed_at = NULL` | Evaluated as eligible new owners. When frontend activates, prompted with guided onboarding wizard. |
| **Cohort C (Post-Deployment New Signups)** | Accounts created after full deployment (`created_at > deployed_at`) | `onboarding_exempted_at = NULL`, `onboarding_completed_at = NULL` | Eligible for guided onboarding upon initial login. Upon completion, `onboarding_completed_at` is truthfully stamped. |
| **Migration Rerun Safety** | Running migration script multiple times in CI/CD or recovery | `migration_onboarding_guard.id = 1` retains original `deployment_cutoff` | Subsequent runs use the persisted cutoff. No new accounts from Cohort B or C are ever exempted on rerun. |

---

## 5. Explicit UNVERIFIED Items

In compliance with testing safety principles:
1. **Meta Embedded Signup Popup:** UNVERIFIED in live environment. Tested with mock credentials and verified that `whatsapp_config` state transitions fail open and do not emit false success.
2. **Evolution Go QR Live Pairing:** UNVERIFIED in live WhatsApp network. Tested locally with offline/timeout simulation to verify that failed pairings keep connection state as unverified/pending.
3. **Live WhatsApp Message Delivery:** UNVERIFIED with real external phone numbers. Verified via simulated test endpoints (`/api/account/ai/test` and mocked client responses).
