# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Delta is a sleep tracking app — a monorepo containing:
- `apps/mobile/` — Expo React Native app (primary UI)
- `services/api/` — Express.js backend
- `packages/shared/`, `packages/constants/`, `packages/types/` — shared code

## Commands

All commands run from `apps/mobile/` unless noted.

```bash
# Mobile development
npm run start          # Start Expo dev server
npm run android        # Run on Android emulator/device
npm run ios            # Run on iOS simulator/device
npm run lint           # ESLint + Prettier check
npm run format         # Auto-fix lint + Prettier

# API (from services/api/)
npm run dev            # Run with ts-node
npm run build          # Compile TypeScript to dist/

# Tests (from repo root)
npx jest apps/mobile/lib/__tests__                            # All unit tests
npx jest apps/mobile/lib/__tests__/sleepTimeline.test.ts      # Single test file
npx jest apps/mobile/lib/__tests__/sleepTimeline.test.ts --watch

# Task runner (from repo root)
just dev               # Run API + mobile in parallel
just lint / just build / just test
```

## Architecture

**Data flow**: Mobile app collects sleep data (Android Health Connect, manual entry, wearables) → Zustand stores cache locally in AsyncStorage (offline-first) → syncs to Express API → PostgreSQL via Supabase.

**State management**: Zustand (`store/authStore.ts`, `sleepStore.ts`, `profileStore.ts`, `healthStore.ts`). The sleep store maintains a sync queue with cooldown logic and batch-syncs via `POST /api/sleep/sync-batch`.

**API client** (`apps/mobile/lib/api.ts`): Centralized fetch wrapper that injects Supabase JWT as Bearer token, 10s timeout, structured error handling.

**Backend** (`services/api/src/`): Feature modules under `modules/` (auth, sleep, profile). Middleware stack: Helmet, CORS, rate limiting (100 req/15min global, 5/hour auth), request ID tracing, Zod validation.

**Sleep analysis engine** (`apps/mobile/lib/sleep*.ts`): 15+ deterministic modules computing a 0–100 sleep score with component weights: duration 35%, deep sleep 20%, REM 20%, efficiency 15%, consistency 10%. Key modules: `sleepScoreCalculator`, `sleepCycleDistributor` (Borbély-derived), `sleepHypnogram`, `sleepStagePredictor`, `sleepBaseline`.

**Routing**: Expo Router file-based routing under `app/`. Tabs at `app/(tabs)/` (sleep, workout, nutrition, account).

**Styling**: NativeWind (Tailwind for React Native). Theme in `packages/shared/src/constants/theme.ts`.

**Native modules** (`apps/mobile/modules/`): Kotlin bridges for Android Health Connect, credentials auth, and screen time.

## Path Aliases (mobile app)

```
@/*         → app/*
@lib/*      → lib/*
@components/* → components/*
@store/*    → store/*
@shared     → ../../packages/shared/src/index.ts
@constants  → constants/index.ts
```

## Conventions

- Sleep UI corner radii: outer radius = inner radius + padding. Never hard-code a single radius across nested components.
- Shared config/constants belong in `packages/constants` or `packages/shared`, not duplicated in `apps/mobile`.
- Unit tests go in `apps/mobile/lib/__tests__/` with `.test.ts` naming. Keep them deterministic and logic-focused (no UI snapshots).
- Commit messages use conventional commits: `feat:`, `fix:`, `perf:`, `chore:`, etc.
- PRs for UI changes should include iOS + Android screenshots.
