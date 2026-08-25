# Appwrite Inventory, Cutover Verification & Deprecation Plan

**Status:** `EXCISED` — Appwrite Auth, Database, Storage, Sites SDKs, infrastructure tree, and setup scripts are removed from this repository.

**Related:** #82, `docs/SUPABASE_CUTOVER_SIGN_OFF.md`

Runtime is forced to `AUTH_PROVIDER=supabase`, `DATABASE_PROVIDER=supabase`, `MIGRATION_MODE=cutover`. Other values throw at boot.

## What was removed

- npm packages `appwrite` and `node-appwrite`
- `src/infrastructure/appwrite/`
- `src/lib/appwrite/`
- `src/lib/appwrite-compat.ts`, `src/lib/appwrite-server-compat.ts`
- `scripts/setup-appwrite-db.ts`, `scripts/verify-appwrite-db.ts`, `scripts/verify-appwrite-storage.ts`, `scripts/migrate-whatsapp-schema.ts`
- CSP allowances for `*.appwrite.io` / `*.appwrite.network`

## What replaced it

| Former path | Current path |
| --- | --- |
| `@/lib/appwrite-server-compat` | `@/lib/db/server` (`createClient`, `getAdminClient`) |
| `@/lib/appwrite-compat` | `@/lib/db/client` |
| Appwrite repositories | `@/lib/db/repositories` (Supabase) |
| Appwrite Storage | `@/lib/storage/repository` + Supabase Storage |
| Appwrite-native worker | `scripts/worker.ts` 5s poller + HTTP crons |

A source-scan test (`src/tests/security/no-appwrite-sdk.test.ts`) fails CI if the SDKs or trees reappear.

Historical audit documents under `docs/audits/` still mention Appwrite; they are dated snapshots, not runbooks.
