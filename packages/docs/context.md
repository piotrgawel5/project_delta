# Project Context for AI Agents

## Architecture Overview

**Project Delta** is a monorepo health and wellness app focused on sleep tracking and analysis. It consists of:

- **Expo React Native mobile app** (primary user interface for iOS/Android/Web)
- **Express.js backend API** (REST endpoints, authentication, data processing)
- **Supabase** (PostgreSQL database, auth functions, secrets management)
- **Shared packages** (TypeScript types, constants, utilities)

The architecture follows a client-server model with offline-first mobile capabilities, passkey-based authentication, and real-time data synchronization.
It now also includes plan-gated premium sleep prediction computed client-side (never persisted to Supabase payloads).

## Repository Structure

```
project_delta/
├── apps/mobile/               # Expo React Native app (primary UI)
│   ├── app/                   # Expo Router file-based routing
│   ├── components/            # React components (sleep, auth, nav, UI)
│   ├── lib/                   # Core utilities (API, auth, sleep logic, storage)
│   ├── modules/               # Native modules (credentials, health-connect, screen-time)
│   ├── store/                 # Zustand stores (auth, profile, sleep data)
│   ├── utils/                 # Helper functions (dates, nutrition)
│   ├── assets/                # Images, fonts, icons
│   ├── package.json           # Mobile dependencies
│   ├── app.json               # Expo configuration
│   ├── tsconfig.json          # TypeScript config with path aliases
│   └── [eslint, prettier, babel, metro configs]
│
├── services/
│   ├── api/                   # Express.js backend
│   │   ├── src/
│   │   │   ├── index.ts       # Server entry point
│   │   │   ├── config/        # Environment & config setup
│   │   │   ├── middleware/    # Auth, CORS, rate-limit, helmet
│   │   │   ├── modules/       # Feature modules (sleep, passkey, etc.)
│   │   │   ├── routes/        # API endpoint definitions
│   │   │   └── utils/         # Helpers (validation, errors)
│   │   ├── Dockerfile         # Multi-stage build (Node 20 Alpine)
│   │   ├── package.json       # API dependencies
│   │   └── tsconfig.json      # API TypeScript config
│   │
│   └── supabase/              # Database & auth functions
│       ├── config.toml        # Supabase project config
│       └── migrations/        # SQL migration files
│
├── packages/                  # Shared code
│   ├── shared/                # Shared types & utilities (@project-delta/shared)
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types/
│   │       └── constants/
│   ├── types/                 # Type definitions
│   ├── constants/             # Constants
│   └── docs/                  # Documentation & context
│
├── package.json               # Monorepo root (Jest dev deps)
├── docker-compose.yml         # Local dev environment orchestration
├── justfile                   # Task runner (PowerShell commands)
└── [AGENTS.md, CHANGELOG.md]
```

## Applications

### Mobile App (`apps/mobile/`)

**Framework:** Expo React Native (v54)  
**Router:** Expo Router (file-based routing)  
**UI Framework:** NativeWind (Tailwind CSS)  
**State Management:** Zustand  
**Database:** Supabase client + async-storage (offline)  
**Authentication:** Server-validated Supabase JWT session (Bearer + httpOnly cookie fallback), passkey + Google + email login  
**Key Libraries:**

- `@react-navigation/*` – drawer, tabs, navigation
- `react-native-reanimated` – animations
- `@gorhom/bottom-sheet` – modals/sheets
- `victory-native` – charts/graphs
- `expo-image-picker`, `expo-auth-session` – native APIs

**Platform Support:**

- iOS (15+), Android (API 28+), Web
- Biometric & fingerprint permissions (Android)
- App scheme: `delta://`

**Key Features (from CHANGELOG):**

- Sleep tracking with deterministic scoring (0-100)
- Plan tiers on profile (`free`, `pro`, `premium`) with `isPaidPlan()` gating
- Premium sleep stage prediction (`premiumPrediction`) with:
  - estimated physiology (VO2max, resting HR, HRV/rMSSD, respiratory rate)
  - predicted stage distribution and cycle timeline
  - recovery index and insight flags
- Screen time detection (native Kotlin module)
- Sleep timeline visualization
- Edit history & provenance tracking
- AI insights & bedtime coaching
- Sleep Intelligence card (see `packages/docs/mobile/screens.md`) surfaces nightly context, AI coaching, and the deep-dive via `SleepAnalysisScreen`
- Manual sleep entry uses the circular clock picker and swipe navigation on `SleepScreen` to refine data without leaving the dashboard

### API Service (`services/api/`)

**Framework:** Express.js (Node 20)  
**Language:** TypeScript (ES2020)  
**Database:** Supabase PostgreSQL  
**Authentication:** Supabase JWT verification on every protected route (`Authorization` header or auth cookie) + WebAuthn verification for passkeys  
**Middleware:** Helmet, strict CORS (explicit origins in production), cookie-parser, enforced rate-limiting  
**Validation:** Zod  
**Port:** 3000 (configurable)

**Endpoints (inferred):**

- Passkey registration/login options & verification
- Auth session endpoints: `/auth/me`, authenticated `/auth/logout`, authenticated `DELETE /auth/account`
- Sleep data sync (batch & individual)
- Sleep log editing with audit trail
- User profile & preferences

**Environment (docker-compose):**

- Runs in Node 20 Alpine container
- Non-root user (nodejs)
- Health checks via `GET /health`
- Reads `.env` for secrets (RP_ID, RP_NAME, RP_ORIGIN, etc.)

## Services

### Supabase (`services/supabase/`)

**Database:** PostgreSQL  
**Key Configuration:**

- PostgreSQL + Auth users + RLS policies used by API and mobile
- Passkey credentials and challenge tables for WebAuthn state

**Migrations:**

- Passkey credentials schema
- User profiles
- User plan column on profiles (`plan` with default `free`)
- Auth methods & enums
- Sleep score & provenance tracking (v20260201)

## Shared Packages

### `@project-delta/shared`

- Centralized types & utilities for mobile + API
- Imported in mobile primarily via `@shared` alias (tsconfig path)
- Location: `packages/shared/src/`

### `packages/types/`

Type definitions (used across monorepo)

### `packages/constants/`

Shared constants

## Development Workflow

### Commands (from mobile root)

```bash
npm run start    # Start Expo dev server + Webpack
npm run ios      # Run iOS simulator/device
npm run android  # Run Android emulator/device
npm run web      # Run Expo web (localhost:19006)
npm run lint     # ESLint (warnings allowed, errors fail)
npm run lint:prettier # Prettier check
npm run format   # Auto-fix ESLint + Prettier
npm run prebuild # Generate native projects
```

### Commands (from API root)

```bash
npm run dev      # ts-node for development
npm run build    # Compile TypeScript → dist/
npm run start    # Run compiled server
```

### Orchestration (justfile)

```bash
just dev    # Start API + mobile Android in parallel
just api    # Start API only
just mobile # Start mobile Android only
just lint   # Run lint on all workspaces
just build  # Build all workspaces
just test   # Run tests
```

### Docker Local Dev

```bash
docker-compose up   # Start API + Supabase (if configured)
```

## Tooling & Configuration

### TypeScript

- **Root:** `tsconfig.json` references `apps/mobile/tsconfig.json` so `npx tsc --noEmit` works from repo root
- **Mobile:** `apps/mobile/tsconfig.json` strict mode, path aliases (`@lib`, `@components`, `@modules`, `@store`, `@shared`, `@constants`)
- **API:** `services/api/tsconfig.json` strict mode, ES2020 target, CommonJS
- **Shared:** `packages/shared/` – declared as main entry for monorepo imports

### Linting & Formatting

- **ESLint:** expo config (v9) + Prettier integration
  - Mobile ignores `dist/`
  - Rules: `react/display-name: off`
- **Prettier:**
  - Print width: 100
  - Single quotes, trailing commas (ES5)
  - Tab width: 2
  - Plugin: `prettier-plugin-tailwindcss` (for className ordering)

### Build System

- **Mobile:** Expo (Webpack/Metro)
  - Babel: expo preset
  - PostCSS: Tailwind CSS v4
  - NativeWind for React Native Tailwind support
  - `expo-router` entry point via `main` field
- **API:** TypeScript → JavaScript compilation to `dist/`

### Testing

- **Framework:** Jest v29.7
- **TS Support:** ts-jest
- **Location:** `apps/mobile/lib/__tests__/` for mobile unit tests
- **Naming:** `.test.ts` suffix (e.g., `sleepTimeline.test.ts`)

## Deployment

### Docker Deployment (API)

- **Image:** Node 20 Alpine (multi-stage)
- **Build Stage:** Installs deps, compiles TS
- **Runtime Stage:** Alpine lightweight runtime, non-root user (`nodejs`)
- **Health Check:** `GET /health` every 30s
- **Environment:** Reads from `.env` and docker-compose environment

### Mobile Deployment

- Configured for iOS (Expo build), Android (Expo EAS), Web
- Adaptive icons & splash screens per platform
- Deep linking scheme: `delta://`
- App package: `com.itork.projectdelta` (Android)

### Database Migrations

- SQL migrations in `services/supabase/migrations/`
- Naming: `YYYYMMDDHHMMSS_description.sql`
- Includes rollback migrations for major changes

## Constraints & Conventions

### Naming & File Structure

- **Components:** PascalCase (e.g., `MetricCard.tsx`, `SleepTimeline.tsx`)
- **Utilities/Hooks:** camelCase (e.g., `useSleepGradient.ts`, `sleepAnalysis.ts`)
- **Tests:** Colocate in `__tests__/` with `.test.ts` suffix
- **Routes (Expo):** File-based structure in `app/` directory

### Code Style

- **TypeScript First:** Use `.ts` / `.tsx` for source files
- **Imports:** Absolute paths via tsconfig aliases preferred
- **Shared Code:** Add to `packages/shared` rather than duplicating across apps
- **Run linting:** `npm run format` before commits

### UI Standards (Sleep Component Context)

- **Optical Corner Radii Rule:** outer radius = inner radius + padding
  - Do NOT hard-code a single radius across nested components
  - Derive radii from padding or element size for visual consistency
- **Styling:** NativeWind/Tailwind classes in `className`
- **Responsive:** Adapt layouts for iOS/Android/Web differences in screenshots
- **Sleep Intelligence & Manual Entry Flows:** The `SleepScreen` now includes the Sleep Intelligence AI insight card and the `SleepAnalysisScreen` deep-dive, plus the circular clock picker for manual entries (`packages/docs/mobile/screens.md`); reuse the same cards/pickers when surfacing hints or edits so animations and tokens stay consistent.

### Sleep Data Conventions

- **Score:** 0–100 deterministic calculation
  - Weights (current): efficiency 25%, deep 20%, REM 20%, WASO 15%, TST 10% (J-curve), regularity 10%
  - Score breakdown now includes optional component fields: `efficiencyScore`, `wasoScore`, `tstScore`, `deepScore`, `remScore`, `regularityScore`
  - Tracked by confidence level: `high`, `medium`, `low`
- **Data Sources:** `health_connect`, `digital_wellbeing`, `usage_stats`, `wearable`, `manual`
- **Premium prediction data:** `premiumPrediction?: PremiumSleepPrediction` on sleep records; optional and backward compatible
- **Persistence rule:** `premiumPrediction` is computed client-side after scoring and is stripped from API/Supabase write payloads
- **Edit Tracking:** All manual edits include `edit_reason` and full history
- **Calculations:** Deterministic, unit-tested for edge cases
- **Sleep Intelligence Contextualization:** Nightly summaries drive the Sleep Intelligence card and the `SleepAnalysisScreen` deep-dive timeline, so reliability expectations (efficiency, sleep debt, timeline color key) must align with the AI insight output described in `packages/docs/mobile/screens.md`

### Git & Commits

- **Conventional Commits:** `feat:`, `fix:`, `docs:`, etc.
- **Scope:** Feature-based (e.g., `feat(sleep):`, `fix(auth):`)
- **PRs:** Include summary, screenshots (iOS + Android if layout differs), linked issues

### Environment & Secrets

- **.env files:** Gitignored (`.env`, `.env.*`)
- **Mobile:** Supabase session is in-memory (`persistSession: false`) and re-hydrated from `/auth/me`
- **API:** Environment variables via docker-compose or `.env`
- **Passkey Config:** RP_ID, RP_ORIGIN, RP_NAME (customizable per deployment)

### Performance & Offline

- **Mobile:** Async-storage for offline queue + Zustand for state
- **Sync:** Batch endpoint `POST /sleep/sync-batch` for efficient offline-to-online transitions
- **Cache:** Sleep data cached locally, invalidated on edits

### Testing Practices

- **Deterministic:** No real-time snapshots; test logic outputs
- **Focus:** Edge cases, data correctness, transformations
- **Example:** Sleep score calculation with 0 duration, 100% deep, missing REM, etc.

### Type Safety

- **API Responses:** Zod validation + TypeScript types
- **Shared Types:** Centralized in `@project-delta/shared`
- **Component Props:** Full TypeScript interfaces

---

**Last Updated:** February 2026  
**Version:** 0.1 Alpha
