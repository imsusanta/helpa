# Operational Runbook: Database Backup and Disaster Recovery

## 1. Automated Backups

Use **Supabase** automated backups and, on paid production plans, point-in-time recovery (PITR). Enable PITR in the Supabase project settings; this is not Appwrite Cloud.

### On-Demand Dump

Prefer the Supabase dashboard backup download, or `pg_dump` against the pooler/direct Postgres URL from the Supabase project settings. Store dumps off-project with encryption at rest.

Do not use `appwrite db dump` — that CLI and backend are not part of this runtime.

## 2. Restore

1. Restore the Supabase project from a snapshot or PITR timestamp.
2. Redeploy the Next.js app (`npm run build` / platform deploy) against the restored project URL and keys.
3. Confirm `/api/health`, login, and a tenant-scoped inbox read.
4. Resume `npm run worker` and cron schedulers.

## 3. RPO / RTO

RPO is bounded by Supabase WAL retention for the chosen plan. RTO is the time to restore the project plus a new app deploy. Record the last successful restore drill in the ops log.
