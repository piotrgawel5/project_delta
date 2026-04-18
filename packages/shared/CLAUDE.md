# packages/shared/CLAUDE.md

Shared types and constants consumed by both `apps/mobile` and `services/api`.
Published as `@project-delta/shared`.

## Directory Structure

```
src/
  index.ts              → Barrel export (everything consumers import from)
  types/
    sleep.ts            → Sleep data types (SleepLog, SleepScore, DataSource, etc.)
    health.ts           → Health Connect types
    nutrition.ts        → Nutrition types
  constants/
    theme.ts            → Theme tokens (Theme, colors, spacing) — global base theme
```

Note: The mobile-specific design tokens (`SLEEP_THEME`, `SLEEP_LAYOUT`, `SLEEP_FONTS`) live in
`apps/mobile/constants/theme.ts`, not here. This package holds the base `Theme` object and shared types only.

## Rules

1. **No React imports.** This package is used by the API (Node.js) — no JSX, no React hooks.
2. **No side effects.** No `console.log`, no `fetch`, no module-level state initialization.
3. **Every exported type should have a corresponding Zod schema** (or note why it doesn't).
4. **Imports**: Other packages import via `@project-delta/shared` alias, not relative paths.
5. **Add here, not in apps/mobile**: If a type is used by both mobile and API, it belongs here.

## What Goes Here vs. Where Else

| Content | Location |
|---------|----------|
| Types used by mobile AND API | `packages/shared/src/types/` |
| Sleep scoring constants (weights, norms) | `packages/constants/src/sleepConstants.ts` |
| Mobile-only design tokens | `apps/mobile/constants/theme.ts` |
| Mobile-only utilities | `apps/mobile/lib/` |
| API-only business logic | `services/api/src/modules/` |

## Adding a New Type

1. Create/edit file in `src/types/<domain>.ts`
2. Export from `src/index.ts`
3. Add Zod schema alongside the type:
   ```ts
   export interface SleepLog {
     id: string;
     userId: string;
     date: string;    // YYYY-MM-DD
     score: number;   // 0–100
   }

   export const SleepLogSchema = z.object({
     id: z.string().uuid(),
     userId: z.string().uuid(),
     date: z.string().date(),
     score: z.number().min(0).max(100),
   });
   ```
4. Verify both mobile and API still typecheck:
   ```bash
   npx tsc --noEmit -p apps/mobile/tsconfig.json
   npx tsc --noEmit -p services/api/tsconfig.json
   ```
