# Mobile App Screens Documentation

This document describes the main screens and navigation flow of the `project_delta` mobile application.

## Main Navigation (Tabs)

The app uses `expo-router` for file-based routing. The primary navigation is a bottom tab bar defined in `app/(tabs)/_layout.tsx`.

### `SleepScreen`

- **File**: `app/(tabs)/sleep.tsx`
- **Description**: The main dashboard for sleep metrics. Features high-quality animations, a "Sleep Intelligence" AI insight card, and a visual representation of sleep stages.
- **Key Features**:
  - Daily, Weekly, and Monthly views.
  - Manual sleep entry with a circular clock picker.
  - Integration with Health Connect.
  - Swipe gestures for navigating between days.

### `WorkoutScreen`

- **File**: `app/(tabs)/workout.tsx`
- **Description**: (Current Placeholder) Intended for logging workouts and tracking training plans.

### `NutritionScreen`

- **File**: `app/(tabs)/nutrition.tsx`
- **Description**: (Current Placeholder) Intended for tracking daily calorie and macro intake.

### `AccountScreen`

- **File**: `app/(tabs)/account.tsx`
- **Description**: User profile management, security settings (passkeys), and health service permissions. Displays user stats like age, weight, and height.

---

## Specialized Screens

### `SleepAnalysisScreen`

- **File**: `app/sleep-analysis.tsx`
- **Description**: Detailed deep-dive into sleep data for a specific day. Includes sleep efficiency, sleep debt, and a colored "Sleep Phases" timeline. Accessible from the `SleepScreen`.

### Onboarding Flow

- **Path**: `app/onboarding/`
- **Description**: A multi-step process for new users to set up their profile.
- **Steps**:
  1. `username.tsx`: Set display name.
  2. `birthday.tsx`: Date of birth.
  3. `sex.tsx`: Biological sex.
  4. `height.tsx`: Height (cm or ft/in).
  5. `weight.tsx`: Current weight.
  6. `sport.tsx`: Preferred sports.
  7. `activity.tsx`: Physical activity level.
  8. `goal.tsx`: Fitness goal (e.g., lose weight, build muscle).
  9. `health.tsx`: Health Connect integration setup.
