# Cross-Reference: API ↔ Mobile ↔ Stores

Read this file at the start of any task that touches both `services/api/` and `apps/mobile/`.
It replaces the need to trace imports across source files.

---

## Auth

**API module:** `services/api/src/modules/auth/`
**Mobile files:** `apps/mobile/lib/auth.tsx`, `apps/mobile/lib/passkey.ts`, `apps/mobile/store/authStore.ts`, `apps/mobile/components/auth/AuthSheet.tsx`
**Native bridge:** `apps/mobile/modules/credentials-auth/` (Android + iOS WebAuthn)

| Endpoint | Called from mobile |
|---|---|
| POST /api/auth/register/options | `lib/passkey.ts` |
| POST /api/auth/register/verify | `lib/passkey.ts` |
| POST /api/auth/login/options | `lib/passkey.ts` |
| POST /api/auth/login/verify | `lib/passkey.ts` |

**Auth flow:** `AuthSheet.tsx` → `lib/passkey.ts` → API → Supabase session → `authStore` (Zustand)
**Session:** Supabase JWT stored via `expo-secure-store`, attached to all API requests by `lib/api.ts`

---

## Sleep

**API module:** `services/api/src/modules/sleep/`
**Mobile files:** `apps/mobile/store/sleepStore.ts`, `apps/mobile/lib/api.ts`, `apps/mobile/app/(tabs)/sleep.tsx`
**Sleep engine:** `apps/mobile/lib/sleep*.ts` (15 modules — client-side only, never hits API)

| Endpoint | Called from mobile | Notes |
|---|---|---|
| POST /api/sleep/sync-batch | `sleepStore.sync()` | Offline queue flush — all writes go here |
| GET /api/sleep/:userId/timeline/:date | `lib/api.ts → fetchSleepTimeline()` | Premium only, `isPaidPlan` gate |

**Write flow:** Component → `sleepStore` action → AsyncStorage (offline cache) → sync queue → `POST /api/sleep/sync-batch` → Supabase
**Timeline flow:** `sleep.tsx` checks `isPaidPlan` → `fetchSleepTimeline()` in `lib/api.ts` → API → `hypnogramTimeline.ts` adapter → `SleepHypnogram` component
**Important:** Sleep scoring is 100% client-side (15 deterministic modules in `lib/sleep*.ts`). The API only stores/retrieves raw logs and timeline phases. Never call the sleep engine from the API side.

---

## Profile

**API module:** `services/api/src/modules/profile/`
**Mobile files:** `apps/mobile/store/profileStore.ts`, `apps/mobile/components/profile/EditProfileModal.tsx`, `apps/mobile/app/(tabs)/account.tsx`

| Endpoint | Called from mobile |
|---|---|
| GET /api/profile | `profileStore` on load |
| PATCH /api/profile | `profileStore` on update |

**Flow:** `account.tsx` / `EditProfileModal.tsx` → `profileStore` action → API → Supabase `user_profiles` table

---

## Health Data (mobile-only, no API)

**Native module:** `apps/mobile/modules/health-connect/` (Android Health Connect bridge)
**Store:** `apps/mobile/store/healthStore.ts`
**Consumer:** `apps/mobile/lib/sleepAnalysis.ts` (uses health data as input to sleep score pipeline)

Health Connect data never leaves the device via API. It feeds the client-side sleep engine only.

---

## Onboarding (mobile-only flow)

**Screens:** `apps/mobile/app/onboarding/` (activity, birthday, goal, health, height, sex, sport, username, weight)
**Component:** `apps/mobile/components/onboarding/OnboardingScreen.tsx` (shared layout)
**Writes to:** `profileStore` → `PATCH /api/profile` on completion

---

## Shared Types & Constants

**Shared package:** `packages/shared/src/` — imported as `@project-delta/shared` in both mobile and API
**Type files:**
- `packages/shared/src/types/sleep.ts` — sleep data types used by both sides
- `packages/shared/src/types/health.ts` — health data types
- `packages/shared/src/types/nutrition.ts` — nutrition types
- `packages/constants/src/` — sleep scoring constants (weights, norms)

**Rule:** If a type is used by both API and mobile, it lives in `packages/shared`. Never duplicate.

---

## Authenticated API Client (mobile)

All API calls from mobile go through `apps/mobile/lib/api.ts`:
- Attaches Supabase JWT from `authStore`
- 10-second timeout
- Zod-validates responses at the boundary
- Treats 404 as "no data yet" (not an error) for sleep timeline

Do not call `fetch()` directly from components or stores. Always go through `lib/api.ts`.
