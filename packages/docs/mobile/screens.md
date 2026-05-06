# Mobile App Screens Documentation

This document describes the main screens and navigation flow of the `project_delta` mobile application.

## Main Navigation (Tabs)

The app uses `expo-router` for file-based routing. The primary navigation is a bottom tab bar defined in `app/(tabs)/_layout.tsx` with `swipeEnabled: false` (horizontal gestures are reserved for sleep day-paging).

### `SleepScreen`

- **File**: `app/(tabs)/sleep.tsx`
- **Description**: Daily sleep dashboard.
- **Key Features**:
  - Hero score, weekly bedtime/wake dots, deep-sleep card, AI insight card.
  - **Premium-gated hypnogram** via `components/sleep/SleepTimelineSection.tsx` — fetches `fetchSleepTimeline(userId, date)`, caches per date in a `Map` ref so day-paging doesn't refetch. Renders the timeline when `plan` is paid + data is present, locked card otherwise.
  - Manual sleep entry, swipe between days, weekly/monthly views.

### `WorkoutScreen`

- **File**: `app/(tabs)/workout.tsx`
- **Description**: Workout dashboard.
- **Key Features**:
  - `MorningBriefCard` mounted at the top (cross-pillar surface).
  - `ActiveSessionCard` when a session is in progress; otherwise consistency grid + stats + history list.
  - "Start workout" CTA → `app/workout/active.tsx`.

### `NutritionScreen`

- **File**: `app/(tabs)/nutrition.tsx`
- **Description**: Daily nutrition dashboard. Currently scaffolded — production design to replace this file wholesale (data plumbing already factored).
- **Key Features**:
  - `MorningBriefCard` at the top.
  - `MacroRing` (kcal/protein/carbs/fats) and `MealList` driven by `selectLogsForDate(today)` + `useMemo(computeMacrosForLogs)`.
  - Floating "+ Add" → `FoodSearchSheet` → `nutritionStore.logFood`.

### `AccountScreen`

- **File**: `app/(tabs)/account.tsx`
- **Description**: Profile, security (passkeys), Health Connect permissions.

---

## Specialized Screens

### Active Workout

- **File**: `app/workout/active.tsx`
- **Description**: In-session logging. Mode toggle pill switches between **quick** (`QuickLogCard`) and **detailed** (`FocusCard` + `CollapsedExerciseCard`) layouts. Plate calculator launched from `FocusCard`.

### `SleepAnalysisScreen`

- **File**: `app/sleep-analysis.tsx`
- **Description**: Detailed deep-dive into sleep data for a specific day.

### Onboarding Flow

- **Path**: `app/onboarding/`
- **Description**: A multi-step process for new users to set up their profile.
- **Steps**:
  1. `username.tsx`
  2. `birthday.tsx`
  3. `weight.tsx`
  4. `height.tsx`
  5. `sex.tsx`
  6. `sport.tsx`
  7. `activity.tsx`
  8. `goal.tsx`
  9. `health.tsx`
- **Soft paywall**: `app/onboarding/paywall.tsx` (registered in `_layout.tsx`). Shown once for `plan === 'free'` users after onboarding via the `loading.tsx` bounce, gated by an AsyncStorage `@delta:paywall_seen_at` flag.
