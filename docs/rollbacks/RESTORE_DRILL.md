# Restore & Rollback Drill

Quarterly drill (roadmap P1: "Add migration rollback tests and restore
drills"). Objective: prove you can recover production data within RTO
and that migrations are safe to revert. Run against a **staging** or
**scratch** project first; never against production data you can't lose.

## Preconditions

- [ ] `supabase` CLI linked to the target project
- [ ] A known-good backup exists (`Dashboard → Database → Backups`)
- [ ] `SUPABASE_DB_PASSWORD` available locally (never committed)

## Part 1 — Backup verification (no data changes)

1. Confirm the latest backup timestamp in Dashboard → Backups.
2. Record it as `SUPABASE_BACKUP_REFERENCE` for the migration runner.

## Part 2 — Fresh-apply + invariant check (scratch project)

```bash
# On a scratch project (not production):
supabase link --project-ref <scratch-ref>
supabase db push --linked --include-all
npm run supabase:validate
npm run supabase:invariants
```

The invariant guard must pass: every policy-bearing table has RLS
enabled, and every UPDATE policy pairs USING with WITH CHECK.

## Part 3 — Restore drill (scratch project)

Simulate "production went down, restore from backup":

1. Corrupt a scratch row intentionally (`delete from ... where id=...`).
2. Restore from backup per Dashboard → Backups → Restore.
3. Verify the deleted row is back and RLS is still ON:

```sql
select relname, relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false;
```

Expect **0 rows** (no table silently reverted to no-RLS).

## Part 4 — Rollback-safety review

For the most recent migration batch, confirm each file is either
transaction-wrapped (`BEGIN` … `COMMIT`) or single-statement, so a
mid-batch failure cannot leave a half-applied schema. Supabase CLI
applies each migration file in its own transaction by default.

## Sign-off

| Date | Operator | Backup ref | Fresh-apply ✅ | Restore ✅ | RLS 0-off ✅ |
|------|----------|-----------|----------------|-----------|-------------|
|      |          |           |                |           |             |
