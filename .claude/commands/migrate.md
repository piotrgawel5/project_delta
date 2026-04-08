# /migrate $ARGUMENTS

Create a Supabase migration for Project Delta:

**$ARGUMENTS**

## Migration Location

`services/supabase/migrations/YYYYMMDDHHMMSS_<description>.sql`

Use current UTC timestamp for the filename prefix.

## Required Structure

Every migration must include:

```sql
-- Migration: <description>
-- Created: YYYY-MM-DD
-- Reversible: YES / describe rollback steps

-- ============================================================
-- UP
-- ============================================================

-- Your migration SQL here

-- ============================================================
-- DOWN (rollback)
-- ============================================================

-- Rollback SQL here
-- e.g., DROP TABLE IF EXISTS <new_table>;
-- e.g., ALTER TABLE <table> DROP COLUMN IF EXISTS <col>;
```

## Conventions

- Use timestamped naming: `20260406120000_add_sleep_stage_column.sql`
- All new tables need RLS enabled immediately:
  ```sql
  ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
  ```
- Policy naming: `<table>_<action>_<role>` (e.g., `sleep_logs_select_owner`)
- Foreign keys must reference `auth.users(id)` for user-owned data
- No `TRUNCATE` or `DROP TABLE` without explicit user confirmation
- New enums: use `CREATE TYPE ... AS ENUM (...)` before table creation

## Checklist

```
[ ] Filename matches YYYYMMDDHHMMSS_description.sql format
[ ] Rollback (DOWN) section is complete and reversible
[ ] RLS enabled on any new tables
[ ] RLS policies added for select/insert/update/delete as needed
[ ] No hardcoded user IDs or secrets
[ ] Migration tested locally before applying
```

## Apply Migration

```bash
npx supabase db push   # apply to remote
npx supabase db reset  # reset local (destructive — confirm first)
```
