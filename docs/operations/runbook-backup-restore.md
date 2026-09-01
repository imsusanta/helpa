# Operational runbook: backup and restore testing

**Status:** `PROCEDURE READY — RESTORE DRILL NOT EXECUTED IN THIS CHANGE`  
Do **not** run destructive tests against production. Mark every live restore as operator-verified.

## 1. Backup strategy

| Layer | What | Owner | Notes |
| --- | --- | --- | --- |
| Supabase automated backups | Daily snapshots (plan-dependent) | Operator / Supabase project | Confirm the paid plan and retention in the dashboard |
| Point-in-time recovery (PITR) | WAL-based restore to a timestamp | Operator | Must be **enabled** on the production project; this repo cannot flip that switch |
| On-demand dump | Encrypted `pg_dump` or dashboard download stored off-project | Operator | Never commit dumps. Never use production dumps as demo fixtures |
| App / config | Vercel env + this git repo | Operator | Migrations live in `supabase/migrations/` |
| Objects | Private storage buckets | Operator | Restore of Postgres does not by itself restore Storage objects |

This is **not** Appwrite Cloud backup. Do not run `appwrite db dump`.

RPO is bounded by the Supabase plan’s WAL/snapshot retention. RTO is restore time plus a new app deploy plus worker restart. Record actual RPO/RTO only after a dated drill.

## 2. Safe restore-testing procedure (staging / throwaway project)

Use a **staging** or disposable Supabase project. Never point the production app at a restored copy until operators choose a production PITR.

1. Create or select a non-production Supabase project.
2. Restore a **staging** snapshot or a sanitized dump into that project.
3. Apply the same migrations as the app (`npm run supabase:validate` then the project migration process).
4. Point a staging Next.js deploy at that project’s URL and keys (not production).
5. Run `npm run worker` against staging only if outbound WhatsApp is disabled or using a sandbox number.
6. Verification (tick in the ops log):
   - [ ] `/api/health` and `/api/health/ready` — no secrets in the JSON
   - [ ] Login as a staging owner
   - [ ] Inbox read is tenant-scoped (second staging user cannot see the first tenant)
   - [ ] RLS still forced (`anon`/`authenticated` cannot `select` `product_outcome_events`)
   - [ ] Create a fictional appointment and confirm it stays on that account
   - [ ] WhatsApp send is blocked or sandbox-only
7. Destroy the throwaway project or rotate its keys when the drill ends.

## 3. Production restore (operator only)

1. Declare SEV-1 and freeze deploys (`docs/incident-response.md` scenario E).
2. Choose snapshot vs PITR timestamp from the Supabase dashboard.
3. Restore **the production project** only after a staging rehearsal if time allows.
4. Redeploy the app to the restored project URL/keys.
5. Resume `npm run worker` and cron secrets.
6. Verify health, login, one tenant inbox, and WhatsApp config status.
7. Record: timestamp, operator, snapshot id, RTO, gaps (Storage, missing WAL, etc.).

## 4. Limitations (must stay visible)

- This change did **not** execute a restore against any live project.
- Storage objects, Meta webhook subscriptions, and Evolution instances are not in `pg_dump`.
- RLS policies restore with the schema; **mis-applied** manual SQL after restore can weaken them — re-run `npm run supabase:validate` and advisor checks.
- Demo seed (`DEMO_MODE=true`) must never run against production (`docs/PRODUCT_DEMO.md`).

## 5. Last successful drill

| Date | Environment | Operator | Result |
| --- | --- | --- | --- |
| *empty* | | | Not recorded |
