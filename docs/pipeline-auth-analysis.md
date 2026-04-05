# Project Delta: Data Pipeline, Cache, Database & Auth Analysis

**Date:** 2026-04-05
**Scope:** Full audit of data pipeline, cache system, database communication, and authentication logic.

---

## 1. Data Pipeline

### 1.1 Flow

```
Health Connect (Android)
    |
    v
sleepStore.ts:fetchSleepData
  +-- getSleepSessions() --> hcRecords
  +-- api.get('/api/sleep/:userId/history') --> cloudRecords
  +-- loadFromCache() --> cachedRecords
    |
    v
sleepCache.ts:mergeAllSources
  Priority: Manual(100) > HC-High(80) > HC-Medium(60) > Cloud(50) > Low(20)
    |
    v
computeScoresForRecords() --> scored records
    |
    +-- set({ recentHistory })          -- immediate UI update
    +-- enqueueScorePersistence()       -- fire-and-forget DB update
    +-- syncPendingRecords()            -- batch POST /api/sleep/sync-batch
            |
            v
    sleep.service.ts:syncBatch --> Supabase upsert on (user_id, date)
```

### 1.2 Cache System

- **Storage**: AsyncStorage with keys `@sleep_cache:{data,pending_sync,last_sync,last_fetch,user_patterns,upload_consent}`
- **Offline-first**: Conflict resolution by source priority ranking
- **Invalidation**: Age-based (90 days), manual clear, 4-month retention in monthlyData
- **Sync queue**: Records marked `needs_sync: true` until batch POST succeeds

### 1.3 Database

- Supabase with `serviceRoleKey` (no RLS -- enforced at API layer)
- Upsert on `(user_id, date)` composite unique constraint
- `sleep_data`: full record with JSONB `score_breakdown`, `screen_time_summary`, `edits`
- `sleep_phase_timeline`: premium feature, per-cycle stage breakdown

### 1.4 Pipeline Issues

| Severity | Issue | File | Lines |
|----------|-------|------|-------|
| CRITICAL | Testing cooldowns (30s) shipped to prod; should be 5min/2min | `sleepCache.ts` | 31-34 |
| HIGH | Batch sync fallback double-writes without deduplication | `sleepStore.ts`, `sleep.service.ts` | 1129-1154, 164-177 |
| HIGH | Race condition in `currentFetchPromise` (no mutex) | `sleepStore.ts` | 105, 462-466 |
| HIGH | Score persistence retry has zero backoff | `sleepStore.ts` | 222-276 |
| HIGH | `synced_at` set by mobile client, not server (clock skew) | `sleepCache.ts`, `sleep.service.ts` | 233, 153 |
| HIGH | Missing migration for `sleep_phase_timeline` table | `services/supabase/migrations/` | N/A |
| MEDIUM | Upload consent check silently returns empty array | `sleepCache.ts` | 207-212 |
| MEDIUM | Manual sleep ID format risks collision | `sleepStore.ts` | 1214 |
| MEDIUM | Duplicated fetch logic: `api.fetch()` vs `fetchSleepTimeline()` | `api.ts` | 27-78, 139-191 |
| MEDIUM | No 401 retry with token refresh in API client | `api.ts` | 62-66 |
| MEDIUM | No DB connection pooling (multiple Supabase clients) | `sleep.service.ts` | 69-73 |
| LOW | Missing index on `(user_id, synced_at DESC)` | DB schema | N/A |

---

## 2. Auth Logic

### 2.1 Token Lifecycle

```
Mobile App
  +-- signIn/signUp/passkey --> api.post('/auth/...')
  |     +-- Server sets cookie (sameSite=lax, httpOnly, 30-day maxAge)
  |         AND returns { access_token, refresh_token } in JSON body
  +-- supabase.auth.setSession({ access_token, refresh_token })
  |     +-- In-memory only (persistSession: false)
  +-- Subsequent requests: Bearer token from supabase.auth.getSession()
  |     +-- Falls back to cookie if no header token
  +-- AppState 'active' --> initialize() --> api.get('/auth/me')
        +-- Re-hydrates session from server cookie
```

### 2.2 Auth Issues

| Severity | Issue | File | Lines |
|----------|-------|------|-------|
| CRITICAL | Passkey account linking: attacker registers passkey for existing user's email | `auth.service.ts` | 213-229 |
| CRITICAL | CORS `origin: true` + `credentials: true` in dev/staging | `config/index.ts` | 57-58 |
| CRITICAL | Rate limits 10x more permissive than documented | `rateLimiter.ts` | 42, 58, 76, 93, 110, 129 |
| CRITICAL | No token refresh mechanism; sessions die after ~1hr | `supabase.ts`, `api.ts` | 11, 62-66 |
| HIGH | Passkey challenge reuse within 5-min window | `auth.service.ts` | 68-77, 263 |
| HIGH | `findUserByEmail` is O(n) pagination through all users | `auth.service.ts` | 79-102 |
| HIGH | CSRF protection missing entirely | `index.ts` | 32-37 |
| HIGH | Request ID injection via client header | `requestId.ts` | 21 |
| HIGH | Burst limiter `skipFailedRequests: true` allows unlimited failures | `rateLimiter.ts` | 136 |
| MEDIUM | Weak password validation (6 chars, no complexity) | `auth.validation.ts` | 6 |
| MEDIUM | 30-day cookie expiration excessive | `auth.controller.ts` | 11 |
| MEDIUM | AppState `initialize()` without debounce | `authStore.ts` | 45-48 |
| MEDIUM | Helmet `crossOriginResourcePolicy: "cross-origin"` | `index.ts` | 25 |
| LOW | SameSite=Lax instead of Strict | `auth.controller.ts` | 9 |
| LOW | `persistSession: false` loses session on process kill | `supabase.ts` | 11 |

---

## 3. Cross-Cutting Concerns

### 3.1 Duplicated Constants
`packages/constants/src/sleepConstants.ts` and `apps/mobile/constants/sleepConstants.ts` are byte-identical copies.

### 3.2 Weight Mismatch
`BASE_COMPONENT_WEIGHTS` (28/18/18/14/10/8/4/2%) is imported but never used. Actual scoring in `sleepAnalysis.ts` uses hardcoded different weights (10/20/20/25/15/10/0/0%).

### 3.3 CamelCase vs snake_case
Shared types use camelCase, mobile store and DB use snake_case. Manual mapping in `toSleepRecord` is error-prone.

### 3.4 Health Connect Stage Mapping
Stage 2 (SLEEPING) mapped to `light` instead of weighted estimate. Stage 3 (OUT_OF_BED) unmapped.

### 3.5 No `startTime < endTime` Validation
Neither mobile nor server validates temporal ordering. Negative-duration records can be stored.

---

## 4. Prioritized Recommendations

### CRITICAL

| # | Issue | Action |
|---|-------|--------|
| C1 | Passkey account linking vulnerability | Require email ownership proof before linking passkey to existing user |
| C2 | CORS origin:true + credentials:true | Default to restrictive allowlist even in dev |
| C3 | Rate limits 10x too permissive | Align code with documented values; remove `skipFailedRequests` |
| C4 | No token refresh | Implement 401 interceptor with token refresh retry |
| C5 | Testing cooldowns in production | Use `__DEV__` flag to switch between test/prod values |

### HIGH

| # | Issue | Action |
|---|-------|--------|
| H1 | Batch sync double-writes | Server returns success list on partial failure; client retries only missing |
| H2 | `currentFetchPromise` race condition | Assign promise before async block |
| H3 | Score persistence zero-backoff | Add exponential backoff (1s, 4s, 16s) |
| H4 | `synced_at` set by mobile | Server-side only; mobile reads from response |
| H6 | Passkey challenge reuse | Delete challenge on first use attempt |
| H7 | `findUserByEmail` O(n) | Direct query on auth.users with email filter |
| H8 | No CSRF protection | Use `sameSite: "strict"` for auth cookies |
| H9 | Request ID injection | Generate server-side only; validate UUID format |

### MEDIUM

| # | Issue | Action |
|---|-------|--------|
| M1 | Duplicated fetch logic | Refactor `fetchSleepTimeline` to use `api.get()` |
| M2 | No DB connection pooling | Singleton Supabase client module |
| M3 | Weight mismatch | Align constants or document divergence |
| M4 | CamelCase/snake_case inconsistency | Automatic transform at boundary |
| M5 | Weak password validation | Increase to 8+ chars |
| M6 | 30-day cookie expiration | Reduce to 7 days |
| M7 | AppState `initialize()` without debounce | Add loading guard |
| M8 | No `startTime < endTime` validation | Cross-field validation |

### LOW

| # | Issue | Action |
|---|-------|--------|
| L1 | Duplicated sleepConstants files | Delete mobile copy |
| L2 | Manual sleep ID collision | Use `crypto.randomUUID()` |
| L3 | SameSite=Lax instead of Strict | Change to Strict |
| L4 | Missing DB index | Add `(user_id, synced_at DESC)` |
