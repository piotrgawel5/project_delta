# CLAUDE.md

Project Delta — sleep, workout, and nutrition tracking monorepo.

Architecture detail (read only when needed for cross-cutting tasks): `packages/docs/context.md`
Cross-cutting reference (API ↔ mobile ↔ stores): `packages/docs/cross-reference.md`

## Monorepo Layout

```
apps/mobile/          → Expo 54 app (primary UI)
services/api/         → Express 4 backend
packages/shared/      → Shared types, theme (@project-delta/shared)
packages/constants/   → Sleep scoring constants
packages/docs/        → Architecture docs, reference assets
```

Nested guides: @apps/mobile/CLAUDE.md · @services/api/CLAUDE.md · @packages/shared/CLAUDE.md

## Commands

### Mobile (run from `apps/mobile/`)
```bash
npm run start          # Expo dev server
npm run android        # Android emulator/device (expo run:android)
npm run ios            # iOS simulator/device (expo run:ios)
npm run web            # Expo web
npm run lint           # ESLint + Prettier check
npm run lint:prettier  # Prettier-only check
npm run format         # Auto-fix ESLint + Prettier
npm run prebuild       # Generate native projects
```

### API (run from `services/api/`)
```bash
npm run dev            # ts-node dev server (port 3000)
npm run build          # Compile TypeScript → dist/
npm run start          # Run compiled server
```

### Tests & Type Checks (from repo root)
```bash
npx jest apps/mobile/lib/__tests__                       # All unit tests
npx jest apps/mobile/lib/__tests__/sleepTimeline.test.ts # Single file
npx tsc --noEmit -p apps/mobile/tsconfig.json            # Type-check mobile
npx tsc --noEmit -p services/api/tsconfig.json           # Type-check API
```

### Orchestration (justfile)
```bash
just dev     # API + mobile Android in parallel
just api     # API only
just mobile  # Mobile Android only
just lint    # Lint all workspaces
just build   # Build all workspaces
just test    # Full test suite
```

## Path Aliases (mobile)

```
@/*           → app/*
@lib/*        → lib/*
@components/* → components/*
@store/*      → store/*
@shared       → packages/shared/src/index.ts
@constants    → constants/index.ts
```

## Non-Negotiable Rules

### Colors & Tokens
- All colors from `SLEEP_THEME` in `apps/mobile/constants/theme.ts`. Zero hardcoded hex. Zero `slate-*` Tailwind classes.
- Grade colors: `SLEEP_THEME.heroGradePresets[grade]` for gradients; `SLEEP_THEME.zoneBarLow/Fair/Great` for quality zones.
- Spacing/radii: `SLEEP_LAYOUT` tokens. **Outer radius = inner radius + padding.** Never same radius on nested elements.
- Typography: `SLEEP_FONTS` (`DMSans-Regular/Medium/SemiBold/Bold`). No `System` or `Inter`.

### Animations
- **Reanimated 4 only** (`useSharedValue`, `useAnimatedStyle`, `withSpring`, `withTiming`). Never `useNativeDriver: false`.
- Never animate `width`/`height`/`padding` — use `transform` instead.
- Target: 120fps. Minimum: 118fps on mid-range Android (Samsung Galaxy A-series).

### SVG
- Gradient on vertical bars: `<Rect fill="url(#grad)">` — **never** `<Line stroke="url(#grad)">` (zero-width bounding box collapses gradient).

### Fetch Architecture
- No waterfall `useEffect` chains. Batch in Zustand with `Promise.all`. Cache guard: check `isLoaded` before fetching.
- Never write directly to Supabase from components. All writes: Zustand → `POST /api/sleep/sync-batch`.

### State (Zustand v5)
- Granular selectors: `useSleepStore(s => s.data?.score)`. Never `useSleepStore()`.
- No inline selector functions inside components (new reference per render = unnecessary re-render).
- **Selectors must return stable references.** Returning a fresh `[]`/`{}`/computed object every call breaks `useSyncExternalStore`'s `Object.is` equality and triggers an infinite render loop ("Maximum update depth exceeded" → gray screen). Cache fallbacks at module scope (`const EMPTY: T[] = []; return s.foo[id] ?? EMPTY;`) and derive computed objects via `useMemo` in the component, never inside the selector.

### Types
- No `any`. Use `unknown` + type guard or a Zod-validated type.
- API responses validated with Zod at boundary (`lib/api.ts`).
- No `as SomeType` casts that bypass runtime validation.

### Architecture
- Shared config/types go in `packages/constants` or `packages/shared` — not duplicated in `apps/mobile`.
- Unit tests in `apps/mobile/lib/__tests__/` with `.test.ts`. Deterministic, no UI snapshots.
- Conventional commits: `feat:`, `fix:`, `perf:`, `chore:`, `docs:`, with scope e.g. `feat(sleep):`.
- PRs touching UI: include iOS + Android screenshots.

## Communication Style

- Direct. No hedging. No "I think" or "maybe".
- Match Figma exactly — "close enough" is wrong.
- Minimal diffs. Don't touch what wasn't asked.
- Large tasks: use P0–P3 stages (foundations → logic → UI → quality). Validate after each stage.
- Blockers: surface the exact issue, list options, ask once.
