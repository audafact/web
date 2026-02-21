# Backup and Restore Playbook

## Overview

- **Backup cadence:** Daily at 2:00 AM UTC (GitHub Actions)
- **Storage:** R2 bucket `audafact-db-backups`, path `db/`
- **Retention:** 30 days
- **Supabase tier:** Free (7-day built-in backup; off-platform backups essential)

## Prerequisites

### R2 Bucket Setup

1. In Cloudflare Dashboard: **R2** → **Create bucket** → name `audafact-db-backups`
2. **R2** → **Manage R2 API Tokens** → Create token with Object Read & Write for this bucket
3. Store: Access Key ID, Secret Access Key, Account ID

### GitHub Secrets (for backup workflow)

| Secret | Description |
|--------|-------------|
| `PG_PROD_HOST` | **Use pooler (Supavisor), not direct.** Example: `aws-0-us-east-2.pooler.supabase.com` |
| `PG_PROD_USER` | Pooler format: `postgres.<project-ref>` — e.g. `postgres.julxtxaspzhwbylnqkkj` |
| `PG_PROD_PASSWORD` | Database password from Supabase Settings → Database |
| `PG_PROD_PORT` | `5432` (session mode) or `6543` (transaction mode) |
| `PG_PROD_DATABASE` | `postgres` (optional, default) |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_BACKUP_ACCESS_KEY_ID` | R2 API token Access Key ID |
| `R2_BACKUP_SECRET_ACCESS_KEY` | R2 API token Secret Access Key |

**Important: GitHub Actions has no IPv6.** Supabase direct (`db.*.supabase.co`) uses IPv6 and will fail with "Network unreachable". Use the **Supavisor pooler** (Session or Transaction mode) from Supabase Dashboard → Connect → Connection string.

### GitHub Variables (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `R2_BACKUP_BUCKET` | `audafact-db-backups` | R2 bucket name |
| `R2_BACKUP_RETENTION_DAYS` | `30` | Days to keep backups |

### Local Restore Prerequisites

- **AWS CLI** — Required for restore (downloads from R2). Install: `brew install awscli` or use the [official installer](https://aws.amazon.com/cli/).
- **PostgreSQL 17 client** — Dumps use format 1.16. Install: `brew install postgresql@17`. The restore script auto-detects it.

## Manual Backup

```bash
# From repository root
export PGHOST="aws-0-us-east-2.pooler.supabase.com"
export PGUSER="postgres.julxtxaspzhwbylnqkkj"
export PGPASSWORD="your-db-password"
export R2_ACCOUNT_ID="your-cf-account-id"
export R2_ACCESS_KEY_ID="your-r2-access-key"
export R2_SECRET_ACCESS_KEY="your-r2-secret-key"

./scripts/backup-prod-to-r2.sh
```

## Restore to Staging (Monthly Drill)

**Rule:** Never restore to prod. Target staging or local only.

**Supabase Cloud limitation:** Restoring to a Supabase Cloud project (staging) only restores the `public` schema. The `auth`, `storage`, and `realtime` schemas are managed by Supabase and cannot be overwritten. Tables that reference `auth.users` (e.g. `public.users`) may have foreign key errors during COPY—app data in `library_tracks`, `track_rotations`, `analytics_events` should still restore.

**Tip:** If `scripts/.env` contains `TARGET_DB_URL`, `R2_ACCOUNT_ID`, `R2_BACKUP_ACCESS_KEY_ID`, and `R2_BACKUP_SECRET_ACCESS_KEY`, the restore script loads them automatically. Otherwise export manually:

```bash
# From repository root
export TARGET_DB_URL="postgresql://postgres:STAGING_PASSWORD@db.STAGING_REF.supabase.co:5432/postgres"
export R2_ACCOUNT_ID="your-cf-account-id"
export R2_ACCESS_KEY_ID="your-r2-access-key"
export R2_SECRET_ACCESS_KEY="your-r2-secret-key"

./scripts/restore-from-r2.sh supabase_prod_2025-02-19_0200.dump
```

## Restore to Local

**Recommended for full monthly drill:** Local Supabase allows full restore (all schemas). Use this to fully verify backups.

```bash
# From repository root
supabase start  # if not already running

export TARGET_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
export R2_ACCOUNT_ID="..."
export R2_ACCESS_KEY_ID="..."
export R2_SECRET_ACCESS_KEY="..."

./scripts/restore-from-r2.sh
```

## Monthly Restore Drill Checklist

- [ ] Pick a recent backup from R2 (`db/` prefix)
- [ ] Restore to staging (not prod), or to local for full verification
- [ ] Run app against staging (use staging config/env, e.g. `NEXT_PUBLIC_SUPABASE_URL` / env pointing at staging project), smoke test
- [ ] Verify row counts / critical tables (`library_tracks`, `track_rotations`, etc.)
- [ ] Document any issues

## Monthly Reminder

Set a recurring reminder so you don't forget the drill. Options:

- **Calendar** — Recurring event on the 1st of each month (Google Calendar, Outlook, etc.)
- **Todo app** — Todoist, Things, Reminders with monthly repeat
- **GitHub** — The `monthly-drill-reminder.yml` workflow creates an issue on the 1st of each month. Set **Settings → Secrets and variables → Actions → Variables** → `MONTHLY_DRILL_ASSIGNEE` to your GitHub username to auto-assign the issue.

## R2 Paths

- Bucket: `audafact-db-backups`
- Path: `db/supabase_prod_YYYY-MM-DD_HHMM.dump`
