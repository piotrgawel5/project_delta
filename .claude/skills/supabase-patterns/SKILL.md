---
name: supabase-patterns
description: >
  Migration conventions, RLS policy patterns, and Supabase client usage rules
  for Project Delta. Apply when creating migrations, writing policies, or using
  the Supabase client in API services.
allowed-tools: Read,Grep,Glob
---

# Project Delta — Supabase Patterns

## Migration Conventions

### File Naming
```
services/supabase/migrations/YYYYMMDDHHMMSS_<snake_case_description>.sql
```
Example: `20260406120000_add_sleep_phase_timeline_table.sql`

### Required Structure

Every migration file must have:

```sql
-- Migration: <description>
-- Created: YYYY-MM-DD
-- Author: <name>

-- ============================================================
-- UP
-- ============================================================

CREATE TABLE IF NOT EXISTS sleep_phase_timeline (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sleep_data_id UUID NOT NULL REFERENCES sleep_logs(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage         TEXT NOT NULL CHECK (stage IN ('awake', 'light', 'deep', 'rem')),
  start_time    TIMESTAMPTZ NOT NULL,
  end_time      TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  cycle_number  INTEGER,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE sleep_phase_timeline ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- DOWN (rollback)
-- ============================================================

DROP TABLE IF EXISTS sleep_phase_timeline;
```

### Rules
- Always include reversible DOWN section
- `IF NOT EXISTS` / `IF EXISTS` guards on all DDL
- `REFERENCES auth.users(id)` for all user-owned tables
- `ON DELETE CASCADE` where child data should follow parent
- Enable RLS immediately after table creation
- No `TRUNCATE` or `DROP TABLE` without explicit confirmation

## RLS Policy Patterns

### Owner-only access (standard pattern)

```sql
-- Users can only see their own rows
CREATE POLICY sleep_logs_select_owner
  ON sleep_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY sleep_logs_insert_owner
  ON sleep_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY sleep_logs_update_owner
  ON sleep_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY sleep_logs_delete_owner
  ON sleep_logs FOR DELETE
  USING (auth.uid() = user_id);
```

### Policy Naming Convention
```
<table>_<operation>_<role>
Examples:
  sleep_logs_select_owner
  sleep_logs_insert_owner
  profiles_select_public      ← if public read is needed
```

### Service Role Bypass
The API uses `SUPABASE_SERVICE_ROLE_KEY` for server-side operations — service role bypasses RLS.
Mobile client uses the anon key — RLS is enforced.

## Supabase Client Usage

### API Service (server-side)
```ts
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // bypasses RLS
);
```

### Mobile Client (client-side)
```ts
// apps/mobile/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,  // RLS enforced
  { auth: { storage: AsyncStorage, autoRefreshToken: true } }
);
```

## Query Patterns

### Always parameterized (no string interpolation)
```ts
// ✓ Correct — parameterized via Supabase client
const { data } = await supabase
  .from('sleep_logs')
  .select('id, date, score, source')
  .eq('user_id', userId)
  .eq('date', date)
  .single();

// ✗ Never — SQL injection risk
await supabase.rpc('raw_query', { sql: `SELECT * WHERE id = '${userId}'` });
```

### Error handling
```ts
const { data, error } = await supabase.from('sleep_logs').select('*').eq('user_id', userId);

if (error) {
  throw new AppError(error.message, 500);
}
// data is typed from generated types
```

## Type Generation

After schema changes:
```bash
npx supabase gen types typescript --project-id <id> > packages/shared/src/types/database.ts
```

## Critical Rules

| Rule | Why |
|------|-----|
| RLS enabled immediately on new tables | Data isolation between users |
| Service role key server-side only | Bypasses RLS — never in mobile |
| Anon key in mobile `.env` only | Public key — RLS protects data |
| Migrations must be reversible | Safe rollback on failures |
| Policy for every CRUD operation | Default deny if policy missing |
