# /implement $ARGUMENTS

Implement the following feature for Project Delta:

**$ARGUMENTS**

## Pre-flight (required before writing code)

1. Read `packages/docs/context.md` in full
2. Read the relevant nested CLAUDE.md (`apps/mobile/CLAUDE.md` or `services/api/CLAUDE.md`)
3. If this touches sleep UI, read `apps/mobile/constants/theme.ts`
4. Declare: which P-stages are needed, which files will be touched per stage

## Stage Model

Follow the staged-delivery-workflow skill:

- **P0 — Foundations:** Types, Zod schemas, API contracts, file scaffolding. No business logic.
- **P1 — Core Logic:** Algorithms, service methods, route handlers, DB queries. No UI.
- **P2 — UI Integration:** Components, Zustand wiring, loading/error/empty states.
- **P3 — Quality:** `npx tsc --noEmit -p apps/mobile/tsconfig.json`, `npm run lint` (from apps/mobile/), `npx jest apps/mobile/lib/__tests__`, implementation summary, residual risks.

## Constraints

- Colors: `SLEEP_THEME`, `SLEEP_LAYOUT`, `SLEEP_FONTS` from `apps/mobile/constants/theme.ts` only
- Animations: Reanimated 4 only. No `useNativeDriver: false`
- Fetches: batch via Zustand `Promise.all`. No waterfall `useEffect` chains
- Selectors: granular — `useSleepStore(s => s.field)`, never `useSleepStore()`
- Types: no `any`, no unvalidated `as T` casts
- SVG gradients: `<Rect fill="url(#)">` not `<Line stroke="url(#)">`
- Shared code goes in `packages/shared` or `packages/constants`, not `apps/mobile`

## Validation (after each stage)

```bash
npx tsc --noEmit -p apps/mobile/tsconfig.json   # or services/api/tsconfig.json
cd apps/mobile && npm run lint
npx jest apps/mobile/lib/__tests__               # if logic touched
```

Surface blockers before advancing stages.
