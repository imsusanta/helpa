# Operational Runbook: Database Backup and Disaster Recovery

## 1. Automated Backups

Appwrite provides automated daily backups with point-in-time recovery (PITR) enabled.

### On-Demand Snapshot Command

```bash
appwrite db dump -f appwrite_backup_$(date +%Y%m%d_%H%M%S).sql
```

## 2. Restore Procedure

To restore a snapshot to a target PostgreSQL database:

```bash
psql -h <db_host> -U postgres -d postgres -f appwrite_backup_YYYYMMDD_HHMMSS.sql
```

## 3. Webhook Dead-Letter Queue Triage

When an unrecoverable webhook failure occurs:

1. Inspect the `webhook_dead_letter` table:
   ```sql
   SELECT event_id, error_message, failed_at FROM webhook_dead_letter WHERE resolved = false;
   ```
2. Correct the underlying configuration (e.g. rotate expired Meta access token).
3. Replay the event using the durable replay utility.
4. Mark the dead letter as resolved:
   ```sql
   UPDATE webhook_dead_letter SET resolved = true, resolved_at = now() WHERE event_id = 'EVENT_ID';
   ```
