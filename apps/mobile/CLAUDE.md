# apps/mobile/CLAUDE.md

Expo React Native app — primary UI for Project Delta.

## Directory Structure

```
app/
  (tabs)/
    sleep.tsx           → Sleep dashboard (main tab)
    workout.tsx         → Workout tab
    nutrition.tsx       → Nutrition tab
    account.tsx         → Account tab
    _layout.tsx         → Floating bottom navbar (swipeEnabled: false — gestures reserved for day paging)
  onboarding/           → Onboarding flow (activity, birthday, goal, health, height, sex, sport, username, weight)
  index.tsx             → Entry (auth gate)
  loading.tsx           → Splash/loading screen
  _layout.tsx           → Root layout (fonts, navigation)

components/
  sleep/
    SleepTimeline.tsx       → Hypnogram timeline SVG
    SleepCalendar.tsx       → Calendar view
    InsightCard.tsx         → AI insight card
    AddSleepRecordModal.tsx → Manual entry modal
    EditHistoryBadge.tsx    → Edit provenance badge
    index.ts                → Barrel export
  auth/
    AuthSheet.tsx           → Auth bottom sheet
  navigation/
    MaterialTopTabs.tsx     → Top tab navigation
    TabBar.tsx              → Custom tab bar
  onboarding/
    OnboardingScreen.tsx    → Shared onboarding layout
  profile/
    EditProfileModal.tsx    → Profile editor
  ui/
    Dialog.tsx, PageTransition.tsx, TypewriterText.tsx

lib/
  api.ts                    → Authenticated fetch wrapper (Supabase JWT, 10s timeout)
  auth.tsx                  → Auth context/provider
  supabase.ts               → Supabase client (anon key + AsyncStorage)
  sleep*.ts                 → Sleep engine (15+ modules)
  planUtils.ts              → Premium plan gating

store/
  authStore.ts              → Auth state (Supabase session)
  sleepStore.ts             → Sleep data, sync queue, batch sync
  profileStore.ts           → User profile
  healthStore.ts            → Health Connect data

modules/
  health-connect/           → Android Health Connect Kotlin bridge
  credentials-auth/         → Passkey/WebAuthn bridge (Android + iOS)
  screen-time/              → Screen time detection (Android)

constants/
  theme.ts                  → SLEEP_THEME, SLEEP_LAYOUT, SLEEP_FONTS, sleepHypnogramColors
  sleepConstants.ts         → Score weights, age norms, Gaussian params
  index.ts                  → Barrel export

utils/
  dates.ts                  → Date helpers
  nutrition.ts              → Nutrition calculations
```

## Pre-Task Checklist

Before writing any code that touches this directory:

```
[ ] Read apps/mobile/constants/theme.ts — source of truth for all tokens
[ ] Read packages/docs/context.md — architecture, data flow, conventions
[ ] If UI task: read packages/docs/mobile/screens.md for existing patterns
[ ] If sleep scoring: read apps/mobile/constants/sleepConstants.ts
[ ] Declare: "I have read theme.ts. Relevant tokens: [list]"
```

## Token Reference

**Theme** (`apps/mobile/constants/theme.ts`):
- `SLEEP_THEME` — all colors (screenBg, cardBg, textPrimary, stage colors, hero gradient presets...)
- `SLEEP_LAYOUT` — spacing, radii, heights (`cardRadiusInner: 16`, `cardRadiusOuter: 20`, `cardPadding: 18`, `screenPaddingH: 16`...)
- `SLEEP_FONTS` — `regular`, `medium`, `semiBold`, `bold` (all DMSans)
- `sleepHypnogramColors` — colors for hypnogram SVG rendering

**Grade colors**: `SLEEP_THEME.heroGradePresets[grade]` (Excellent/Great/Good/Fair/Poor/Bad/Terrible/Empty)

**Zone colors**: `SLEEP_THEME.zoneBarLow` (red) / `zoneBarFair` (amber) / `zoneBarGreat` (green)

## Component Library

| Need | Library |
|------|---------|
| Bottom sheets | `@gorhom/bottom-sheet` only |
| Blur / frosted glass | `expo-blur` `BlurView` only |
| Images | `expo-image` only (better caching) |
| Animations | `react-native-reanimated` v4 only |
| SVG | `react-native-svg` |
| Charts | `victory-native` |
| Icons | `@expo/vector-icons` |

## Routing (Expo Router)

File-based routing under `app/`. Tabs at `app/(tabs)/`. Onboarding at `app/onboarding/`.
- `swipeEnabled: false` on tabs — horizontal gestures reserved for day paging in SleepScreen
- Deep link scheme: `delta://`
- No manual `NavigationContainer` — Expo Router manages it

## Sleep Engine (`lib/sleep*.ts`)

15+ deterministic modules. Key files:

| File | Role |
|------|------|
| `sleepAnalysis.ts` | Score pipeline entry point |
| `sleepCalculations.ts` | Component sub-scores |
| `sleepCycleDistributor.ts` | Borbély-derived cycle allocation |
| `sleepStagePredictor.ts` | Premium stage prediction (plan-gated) |
| `sleepBaseline.ts` | Personal vs population norm blending |
| `sleepHypnogram.ts` | Hypnogram data preparation |
| `sleepColors.ts` | Stage → color mapping |
| `sleepWeeklyInsights.ts` | Weekly view-model (score deltas, bedtime dots) |

**Score weights**: duration 28%, deepSleep 18%, remSleep 18%, efficiency 14%, WASO 10%, consistency 8%, timing 4%, screenTime 2%.

Premium timeline: fetched via `fetchSleepTimeline` in `lib/api.ts`, gated by `isPaidPlan`.

## Offline-First Data Flow

```
User interaction
  → Zustand store action
  → AsyncStorage (offline cache)
  → Sync queue (sleepStore)
  → POST /api/sleep/sync-batch (when online)
  → Supabase PostgreSQL
```

Never write directly from components to Supabase.

## Validation Commands

```bash
cd apps/mobile

npm run lint               # ESLint + Prettier check
npm run format             # Auto-fix
npx tsc --noEmit           # Type check (from apps/mobile — uses local tsconfig)

# From repo root:
npx jest apps/mobile/lib/__tests__                          # All tests
npx jest apps/mobile/lib/__tests__/<name>.test.ts           # Single test
npx jest apps/mobile/lib/__tests__/<name>.test.ts --watch   # Watch mode
```
