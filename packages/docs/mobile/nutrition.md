# Nutrition Pillar

End-to-end nutrition tracking — meal logs, macro rollups, food catalog with OpenFoodFacts cache, offline-first sync.

## Files

| Path | Role |
|------|------|
| `apps/mobile/store/nutritionStore.ts` | Zustand store (persist + offline queue) |
| `apps/mobile/app/(tabs)/nutrition.tsx` | Screen scaffold (Figma-replaceable) |
| `apps/mobile/components/nutrition/MacroRing.tsx` | Daily kcal/macro ring |
| `apps/mobile/components/nutrition/MealList.tsx` | Per-meal log list |
| `apps/mobile/components/nutrition/FoodSearchSheet.tsx` | Bottom sheet — search/log |
| `apps/mobile/lib/nutritionTDEE.ts` | Pure TDEE + macro target helpers |
| `packages/shared/src/types/nutrition.ts` | `Food`, `NutritionLog`, `MealType`, Zod schemas |
| `services/api/src/modules/nutrition/` | API module (routes/controller/service/validation/openFoodFacts) |
| `services/supabase/migrations/20260505000000_create_nutrition_tables.sql` | `foods` + `nutrition_logs` tables |

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/nutrition/logs/:userId` | List logs (optional `from`/`to` query) |
| POST | `/api/nutrition/logs/sync` | Batch sync offline logs (idempotent by client UUID) |
| DELETE | `/api/nutrition/logs/:id` | Delete a log |
| GET | `/api/nutrition/foods/search?q=&locale=` | Trigram name search (Supabase) → fallback OpenFoodFacts |
| GET | `/api/nutrition/foods/barcode/:code` | Barcode lookup → OpenFoodFacts (cached in `foods`) |

## Offline-First Write Flow

```
Component
  → nutritionStore.logFood({ userId, date, mealType, food, grams })
  → optimistic insert into logsByDate
  → push to syncQueue
  → drainSyncQueue() → POST /api/nutrition/logs/sync
  → on success: clear queue
  → on failure: keep queued, retry on next AppState `active`
```

Log IDs are generated **client-side** via `expo-crypto` `randomUUID()` so the sync endpoint is idempotent.

## Selectors

```ts
import { selectLogsForDate, computeMacrosForLogs } from '@store/nutritionStore';

const logs = useNutritionStore(selectLogsForDate(today));   // stable empty-array ref
const macros = useMemo(() => computeMacrosForLogs(logs), [logs]);
```

**Do not** turn `computeMacrosForLogs` into a Zustand selector — it allocates a new object every call and triggers a `useSyncExternalStore` infinite loop in Zustand v5. Always derive macros via `useMemo` over the logs array.

## TDEE

`apps/mobile/lib/nutritionTDEE.ts` is pure: BMR (Mifflin–St Jeor) × activity multiplier, with `computeMacroTargets(profile, goal)` returning `{ kcal, proteinG, carbsG, fatsG }`. Tested in `lib/__tests__/nutritionTDEE.test.ts`.
