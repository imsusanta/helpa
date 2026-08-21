# P0 Production Recovery Audit & Remediation Plan

**System Baseline & Recovery Audit Record**

---

## 1. Starting Baseline

- **Verified Starting Main SHA**: `ede0bd0e9ea2fecf4ed3cfe2628f6440bad3cf22`
- **Recovery Branch**: `fix/p0-storage-auth-production-recovery`
- **Target Release PR**: `https://github.com/imsusanta/wacrm_susanta/pull/new/fix/p0-storage-auth-production-recovery`
- **Appwrite Endpoint**: `https://sgp.cloud.appwrite.io/v1`
- **Appwrite Project ID**: `6a79822b003adde92f63`
- **Appwrite Database ID**: `helpa_main`
- **Configured Storage Buckets**:
  - `avatars`
  - `chat-media`
  - `voice-transcripts`
  - `webhook-payloads`
  - `pdf-tickets`

---

## 2. Root Cause Analysis

### A. Storage Bucket Upload Failure

- **Symptom**: `Upload failed: Storage bucket with the requested ID could not be found.`
- **Root Cause**: Storage buckets were not created during deployment/provisioning. `storage.repository.ts` attempted to lazily create buckets on demand during user HTTP requests (`ensureBucketExists()`). When this failed or permissions were rejected, `storage.repository.ts` swallowed the error and fell back to base64 Data URLs, hiding storage failures.

### B. Security & Identity Fallbacks

- **Symptom**: Hardcoded identifiers (`user_susanta`, `default_account`) found in user avatar routes and auth hooks.
- **Root Cause**: Development fallbacks were left in production request handlers instead of throwing HTTP 401 Unauthorized or 403 Forbidden.

### C. Dangerous Broad Permissions

- **Symptom**: `appwrite-compat.ts` generated `write("any")`, `read("any")`, `update("any")`, `delete("any")` permissions.
- **Root Cause**: Quick fixes added broad `any` permissions to bypass Appwrite permission validation instead of deriving least-privilege `user:${userId}` permissions.

### D. CI Pipeline Failure

- **Symptom**: CI pipeline failed at Prettier `format:check`.
- **Root Cause**: Several code files were unformatted according to Prettier rules.

---

## 3. Remediation Plan

1. **Storage Manifest & Provisioning Engine**:
   - Create `src/infrastructure/appwrite/storage-manifest.ts` defining all 5 required buckets.
   - Update `scripts/setup-appwrite-db.ts` to idempotently provision buckets with `--dry-run`, `--apply`, and `--confirm-production` options.
   - Add verification script `scripts/verify-appwrite-storage.ts` and `npm run appwrite:verify`.

2. **Secure Upload Architecture**:
   - Refactor `src/infrastructure/appwrite/repositories/storage.repository.ts` to remove lazy bucket creation, base64 fallbacks, and swallowed errors.
   - Refactor `src/app/api/account/avatar/route.ts` to enforce server-side auth (401/403), remove `user_susanta`, and clean up uploaded files if DB updates fail.

3. **Least-Privilege Permissions**:
   - Remove `write("any")`, `read("any")`, `update("any")`, `delete("any")` from `appwrite-compat.ts`.
   - Implement regression tests verifying that no `any` permissions are created for protected resources.

4. **Identity & Swallowed Error Remediation**:
   - Remove `default_account` fallback in `use-auth.tsx`.
   - Ensure subscription upgrade and mutation routes verify database writes before returning success.

5. **CI & Deployment Verification**:
   - Run Prettier formatting (`npm run format`).
   - Run full CI quality gates (`typecheck`, `lint`, `test`, `build`).

---

**Audit Status**: Phase 1 Audit Completed. Proceeding with Remediation Execution.
