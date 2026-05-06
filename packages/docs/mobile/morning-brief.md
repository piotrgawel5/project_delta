# Morning Brief — Cross-Pillar Surface

A single insight card combining last night's sleep, recent training load, and recent meals into one actionable summary. Mounted at the top of the **Workout** and **Nutrition** tabs.

## Files

| Path | Role |
|------|------|
| `apps/mobile/lib/morningBrief.ts` | Pure `buildMorningBrief(input)` composer — returns `SleepInsight` shape |
| `apps/mobile/lib/morningBriefSelectors.ts` | Pure selectors (`selectSleepNight`, `selectLast7DaysDeep`, `selectRecentSessions`, `selectRecentMeals`, `selectMorningBriefProfile`, `buildMorningBriefInput`) |
| `apps/mobile/lib/useMorningBrief.ts` | Hook — granular subscriptions to sleep/workout/nutrition/profile stores |
| `apps/mobile/components/home/MorningBriefCard.tsx` | Wraps existing `InsightCard` so the surface is stable |

## Composition

```
useMorningBrief()
  → granular store subscriptions (recentHistory, sessions, logsByDate, profile)
  → buildMorningBriefInput(...)        // pure
  → buildMorningBrief(input)           // pure → SleepInsight
  → MorningBriefCard renders InsightCard
```

The composer detects scenarios in priority order — `lowSleep` → `heavyLegs` → `lowProtein` → `lateMeal` → `onTrack` — and returns headline/subheadline/contributingSignals/recommendations.

## Why a wrapper, not a new card

`MorningBriefCard` is a one-line passthrough to `InsightCard`. The wrapper exists so the import surface (`MorningBriefCard`) is stable for tab callers. Production design replaces this with a custom hero/recommendations layout while keeping the same prop contract.

## Adding a scenario

1. Add a branch in `morningBrief.ts` `buildMorningBrief()`.
2. Add an `i18n` key under `morningBrief.*` in `apps/mobile/locales/{en,pl}.json`.
3. Add a unit test in `lib/__tests__/morningBrief.test.ts` for input shapes that should trigger it.
