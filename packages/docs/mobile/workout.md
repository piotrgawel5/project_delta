# Workout Pillar

Active session logging, progressive-overload suggestions, equipment-aware exercise picker, plate calculator.

## Logging modes

`workoutStore.loggingMode` — persisted as `"quick" | "detailed"`.

| Mode | Surface | Behavior |
|------|---------|----------|
| `quick` | `components/workout/QuickLogCard.tsx` | Repeat-last set / +2.5 kg top set / skip — single tap |
| `detailed` | `components/workout/FocusCard.tsx` (existing) | Manual rep/weight stepper, RPE, notes |

Toggle pill on `app/workout/active.tsx` switches between them.

## Progressive Overload Suggester

`apps/mobile/lib/workoutProgression.ts` exports a pure `suggestNextSession(sessionsForExercise, exerciseId)` returning `{ sets, rationale, isOverload }`.

Rules (in order):
- Bodyweight → repeat last
- Did **not** hit rep target on last session → repeat last (no weight bump)
- Sum of weight added in the last 7 days ≥ `WEEKLY_CAP_KG` (5 kg) → hold
- Top-set RPE ≥ `RPE_OVERLOAD_CEILING` (8) → hold
- Otherwise → +`STEP_KG` (2.5 kg) on top set, others repeat

Tested in `lib/__tests__/workoutProgression.test.ts`.

## Plate Calculator

`apps/mobile/lib/plateCalc.ts` — greedy split using `[25, 20, 15, 10, 5, 2.5, 1.25]` plates by default, returning `{ perSide, achievedKg, remainderKg }`. EPS = 1e-6 to absorb floating-point drift.

`components/workout/PlateCalculator.tsx` — modal with barbell visualisation, opened from a stepper button on `FocusCard`.

## Equipment Filter

- `packages/shared/src/types/workout.ts` — `Equipment = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "kettlebell" | "bands" | "other"`. Optional on `Exercise`.
- `lib/workoutFixtures.ts`:
  - 12 bodyweight exercises tagged explicitly.
  - `getExerciseEquipment(ex)` infers from id naming for the legacy 68 entries.
  - `filterExercisesByEquipment(exercises, allowed)` and `findSubstitute(id, allowed)` helpers.
- `workoutStore.availableEquipment: Equipment[]` persisted; chip row in `ExercisePickerSheet` toggles it.

When `availableEquipment` is empty, all exercises show (no implicit filter).

## Files

| Path | Role |
|------|------|
| `apps/mobile/store/workoutStore.ts` | Sessions, sets, sync queue, `loggingMode`, `availableEquipment` |
| `apps/mobile/app/workout/active.tsx` | Active session screen with quick/detailed toggle |
| `apps/mobile/components/workout/QuickLogCard.tsx` | Quick-log surface |
| `apps/mobile/components/workout/FocusCard.tsx` | Detailed-mode card + plate-calc launcher |
| `apps/mobile/components/workout/PlateCalculator.tsx` | Plate-split modal |
| `apps/mobile/components/workout/ExercisePickerSheet.tsx` | Picker with equipment chips |
| `apps/mobile/lib/workoutProgression.ts` | `suggestNextSession()` |
| `apps/mobile/lib/plateCalc.ts` | `calcPlates()` |
| `apps/mobile/lib/workoutFixtures.ts` | Exercise catalog + equipment helpers |
