# SLEEP SCREEN — ENGINEERING AUDIT & REMEDIATION MEMO

**Classification:** Internal / Engineering  
**Date:** 2026-02-15  
**Version:** 1.0  
**Scope:** `apps/mobile/` — Sleep feature surface  
**Prepared for:** Claude Code / Autonomous Coding Agent  

---

## AGENT OPERATING INSTRUCTIONS

This document is structured for autonomous execution. Follow these rules:

1. **Work top-to-bottom by severity tier.** Complete all CRITICAL items before MAJOR.
2. **Each task is atomic.** A task is complete only when: (a) the code change is made, (b) TypeScript compiles without errors in the affected file, (c) no existing logic is broken.
3. **File paths are relative to `apps/mobile/`** unless stated otherwise.
4. **Before editing any file**, read the current state of that file. Do not assume the line numbers below are still accurate if the file was previously modified.
5. **Do not refactor opportunistically.** Only change what is explicitly described in each task.
6. **After completing all tasks in a tier**, stop and surface a summary of changes made before proceeding to the next tier.

---

## PROJECT CONTEXT

**Repo:** `project_delta` (monorepo)  
**App:** Expo React Native v54, Expo Router, Zustand, react-native-reanimated v4  
**Primary files under audit:**

| File | Role |
|---|---|
| `app/(tabs)/sleep.tsx` | Sleep screen — main orchestrator (600+ lines) |
| `store/sleepStore.ts` | Zustand store — all sleep data fetching, scoring, sync |
| `lib/sleepCalculations.ts` | Legacy + new sleep scoring logic |
| `lib/sleepAnalysis.ts` | Dynamic scoring engine (wraps shared package) |
| `lib/sleepFormatters.ts` | Time/duration formatting utilities |
| `lib/sleepCache.ts` | AsyncStorage cache layer |
| `components/sleep/AddSleepRecordModal.tsx` | Manual sleep entry modal |
| `components/sleep/MetricCard.tsx` | Individual metric card component |

**Key aliases (tsconfig):**  
`@lib` → `lib/`  
`@store` → `store/`  
`@components` → `components/`  
`@shared` → `packages/shared/src/`

---

## SEVERITY TIER DEFINITIONS

| Tier | Label | Description |
|---|---|---|
| 🔴 P0 | CRITICAL | Data correctness violation or user-facing broken behavior. Ship-blocker. |
| 🟠 P1 | MAJOR | Wrong UX, significant performance regression, or data loss risk. |
| 🟡 P2 | MODERATE | Code quality, silent bugs, minor data issues. |
| 🔵 P3 | MINOR | Naming, type safety, optimization. |

---

## 🔴 CRITICAL — P0

### BUG-001 · Hardcoded description text shown regardless of actual sleep data

**File:** `app/(tabs)/sleep.tsx`  
**Location:** `renderItem` inside the FlatList, `pagerItem` render block  
**Symptom:** A user who slept 3 hours sees "Your sleep duration last night was above your goal, providing optimal restorative sleep..." — text is unconditionally hardcoded for any `itemHasData === true` case.

**Current code:**
```tsx
{itemHasData
  ? 'Your sleep duration last night was above your goal, providing optimal restorative sleep for complete recovery. You barely stirred awake last night - great stuff.'
  : 'No sleep data yet for this day. Add a record to see your score and trends.'}
```

**Required fix:**  
Replace the static string with a derived description. Use `itemHistory.sleep_score` and `itemHistory.duration_minutes` to generate a contextual 1–2 sentence string. Use this logic table:

| Condition | Text |
|---|---|
| `sleep_score >= 85` | "Excellent night — your sleep hit all targets for duration and recovery." |
| `sleep_score >= 70` | "Good night overall. A little more deep sleep would push this higher." |
| `sleep_score >= 55` | "Decent sleep, but you fell short of your duration goal." |
| `sleep_score < 55 && sleep_score > 0` | "Tough night. Short sleep or frequent waking dragged the score down." |
| `!sleep_score && durationMinutes > 0` | "Sleep recorded. Score will appear once scoring is complete." |

Extract this into a pure function `getSleepDescription(score: number, durationMinutes: number): string` placed in `lib/sleepFormatters.ts`.

---

### BUG-002 · Sleep efficiency metric is calculating goal achievement, not efficiency

**File:** `app/(tabs)/sleep.tsx`  
**Location:** ~line 170, `sleepEfficiency` derivation  

**Current (wrong) code:**
```tsx
const sleepEfficiency = durationMinutes
  ? Math.min(100, Math.round((durationMinutes / 480) * 100))
  : 0;
```
This calculates "% of 8-hour goal achieved" — not sleep efficiency. The card label says "Efficiency" but shows the wrong metric. Sleep efficiency = `TST / Time In Bed * 100`.

**Required fix:**
```tsx
const timeInBedMinutes =
  hi?.start_time && hi?.end_time
    ? Math.round(
        (new Date(hi.end_time).getTime() - new Date(hi.start_time).getTime()) / 60000
      )
    : durationMinutes;

const sleepEfficiency =
  timeInBedMinutes > 0
    ? Math.min(100, Math.round((durationMinutes / timeInBedMinutes) * 100))
    : 0;
```

Also update the `efficiencySubtitle` thresholds — 85%+ is "Excellent", 75–84% is "Good", below 75% is "Low". These are clinically meaningful thresholds for true sleep efficiency, not the current arbitrary values.

---

### BUG-003 · `cachedHistory` Map permanently stores `null` — data never refreshes

**File:** `app/(tabs)/sleep.tsx`  
**Location:** The `useEffect` that populates `cachedHistory`  

**Current code:**
```tsx
useEffect(() => {
  const next = new Map(cachedHistory);
  for (let i = cacheRange.min; i <= cacheRange.max; i += 1) {
    const date = monthDates[i];
    if (!date) continue;
    const key = dateKey(date);
    if (next.has(key)) continue;           // ← BUG: null is a valid Map value
    const record = historyByDate.get(key) || null;
    next.set(key, record);                 // null gets stored
  }
  ...
}, [cacheRange, monthDates, historyByDate, cachedHistory]);
```

When a date has no data at cache time, `null` is stored. Later, when `historyByDate` updates with real data, the `next.has(key)` guard skips the update. The UI stays empty.

**Required fix:** Change the guard to only skip if the stored value is non-null:
```tsx
const existing = next.get(key);
if (existing !== null && existing !== undefined) continue;
```

---

### BUG-004 · Calendar and Add buttons become untappable after 2px of scroll

**File:** `app/(tabs)/sleep.tsx`  
**Location:** `fixedTopSection` View, `isTopOverlayFront` logic  

**Current code:**
```tsx
<View
  pointerEvents={isTopOverlayFront ? 'auto' : 'none'}  // ← loses interactivity
  ...
```

```tsx
useAnimatedReaction(
  () => scrollY.value <= 2,   // ← flips at 2px of scroll
  (isFront, prev) => { ... }
);
```

After scrolling 2px, the calendar icon and add button stop receiving touch events. Users must scroll back to top to access core navigation. This is a critical UX regression.

**Required fix:**  
Decouple visual z-index from pointer events. The buttons must always be tappable regardless of scroll position. Move the buttons to a separate absolutely-positioned View that is **never** `pointerEvents="none"`:

```tsx
{/* This container handles only the gradient/title — can lose pointer events */}
<View
  pointerEvents={isTopOverlayFront ? 'auto' : 'none'}
  onLayout={handleTopSectionLayout}
  style={[styles.fixedTopSection, { paddingTop: insets.top + 20, zIndex: isTopOverlayFront ? 3 : 0 }]}>
  {/* ... pager content only, no buttons here ... */}
</View>

{/* Buttons always on top, always interactive */}
<View style={[styles.persistentControls, { top: insets.top + 20, zIndex: 10 }]}>
  <View style={{ width: 44 }} />
  <View style={styles.rightIcons}>
    <Pressable style={styles.iconButton} onPress={() => setIsCalendarVisible(true)}>
      <Ionicons name="calendar-outline" size={20} color="white" />
    </Pressable>
    <Pressable style={styles.iconButton} onPress={() => setIsAddModalVisible(true)}>
      <Ionicons name="add" size={24} color="white" />
    </Pressable>
  </View>
</View>
```

Add `persistentControls` to `StyleSheet.create`:
```tsx
persistentControls: {
  position: 'absolute',
  left: 0,
  right: 0,
  flexDirection: 'row',
  justifyContent: 'space-between',
  paddingHorizontal: SHEET_PADDING_X,
},
```

---

### BUG-005 · `forceSaveManualSleep` rollback is incomplete — optimistic update persists on API failure

**File:** `store/sleepStore.ts`  
**Location:** `forceSaveManualSleep` catch block  

**Current code:**
```tsx
} catch (error) {
  await get().loadCachedData(); // loads cache which may already contain the optimistic record
}
```

The sequence is: (1) set optimistic UI state, (2) call API, (3) `upsertCacheRecord` writes to cache — if the API fails at step (2), step (3) may still run depending on error timing, or the optimistic state from step (1) is now inconsistent with the cache.

**Required fix:** Capture pre-save state snapshot and restore it on failure:

```tsx
forceSaveManualSleep: async (userId, startTime, endTime): Promise<boolean> => {
  if (!userId) return false;

  // Snapshot current state BEFORE optimistic update
  const previousWeeklyHistory = get().weeklyHistory;
  const previousMonthlyData = get().monthlyData;

  try {
    // ... all existing logic ...

    // 1. OPTIMISTIC UI UPDATE
    set((state) => { /* ... existing logic ... */ });

    // 2. API call
    await api.post('/api/sleep/log', { ...apiPayload });

    // 3. Cache write (only on API success)
    await upsertCacheRecord({ ...sleepRecord, source: 'manual' as any, confidence: 'low' }, false);
    await markRecordsSynced([date]);

    return true;
  } catch (error) {
    console.error('[SleepStore] Error force saving manual sleep:', error);
    // Restore exact pre-save state — not the cache
    set({ weeklyHistory: previousWeeklyHistory, monthlyData: previousMonthlyData });
    return false;
  }
},
```

---

## 🟠 MAJOR — P1

### BUG-006 · iOS has no fetch cooldown — every app event triggers an uncooldown'd API call

**File:** `store/sleepStore.ts`  
**Location:** `fetchSleepData`, cooldown check block  

**Current code:**
```tsx
const shouldFetchHC = Platform.OS === 'android' && get().isConnected;
const shouldFetch = shouldFetchHC ? await shouldFetchFromHealthConnect() : true; // iOS = always true
```

On iOS, every call to `fetchSleepData` — tab focus, pull-to-refresh, app resume, component mount — hits the API immediately with no rate limiting.

**Required fix:** Apply the same cooldown for cloud fetches regardless of platform. Add a separate `lastCloudFetch` timestamp to the store state:

```tsx
// In SleepState interface
lastCloudFetchTime: number;

// In fetchSleepData, before cloud fetch
const CLOUD_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
const now = Date.now();
const lastCloud = get().lastCloudFetchTime;
const shouldFetchCloud = now - lastCloud > CLOUD_COOLDOWN_MS;

if (!shouldFetchCloud && !forceRefresh) {
  console.log('[SleepStore] Skipping cloud fetch — cooldown active');
  await get().loadCachedData();
  set({ loading: false });
  return;
}

// After successful cloud fetch:
set({ lastCloudFetchTime: Date.now() });
```

Initialize `lastCloudFetchTime: 0` in the store default state. The existing `refreshData(userId, forceRefresh = true)` path will bypass this correctly since `resetCooldowns()` is called first.

---

### BUG-007 · `toSleepEngineProfile` hardcodes chronotype and sleep goal — scoring engine is bypassed

**File:** `store/sleepStore.ts`  
**Location:** `toSleepEngineProfile` function  

**Current code:**
```tsx
function toSleepEngineProfile(profile: UserProfile | null): SleepEngineUserProfile {
  return {
    age,
    chronotype: 'intermediate', // always
    sleepGoalMinutes: 480,      // always 8h
  };
}
```

The scoring engine in `sleepAnalysis.ts` supports `chronotype`, `sleepGoalMinutes`, `sex`, `activityLevel` — all of which affect weight distribution and score normalization. None are passed.

**Required fix:** Map all available profile fields:

```tsx
function toSleepEngineProfile(profile: UserProfile | null): SleepEngineUserProfile {
  if (!profile) return { sleepGoalMinutes: 480 };

  let age: number | undefined;
  const dob = profile.date_of_birth || profile.birth_date;
  if (dob) {
    const dobDate = new Date(dob);
    if (!Number.isNaN(dobDate.getTime())) {
      const now = new Date();
      age = now.getFullYear() - dobDate.getFullYear();
      if (
        now.getMonth() < dobDate.getMonth() ||
        (now.getMonth() === dobDate.getMonth() && now.getDate() < dobDate.getDate())
      ) {
        age -= 1;
      }
    }
  }

  // Map activity level to chronotype heuristic if no explicit chronotype stored
  const chronotypeMap: Record<string, SleepEngineUserProfile['chronotype']> = {
    sedentary: 'evening',
    light: 'intermediate',
    moderate: 'intermediate',
    active: 'morning',
    very_active: 'morning',
  };

  return {
    age,
    chronotype: chronotypeMap[profile.activity_level ?? 'moderate'] ?? 'intermediate',
    sleepGoalMinutes: profile.sleep_goal_minutes ?? 480,
  };
}
```

Note: If `UserProfile` does not have a `sleep_goal_minutes` field, add it to the type definition and default to `480`. Do not add it to the Supabase schema without a migration.

---

### BUG-008 · `scoreAndPersistRecords` fires N individual Supabase UPDATE calls per fetch

**File:** `store/sleepStore.ts`  
**Location:** `scoreAndPersistRecords` function  

**Current code:**
```tsx
await Promise.all(
  persistable.map(async (record) => {
    await supabase.from('sleep_data').update({ sleep_score, score_breakdown }).eq('id', record.id);
  })
);
```

30 records = 30 parallel Supabase calls on every `fetchSleepData`. This will hit Supabase connection limits in production.

**Required fix:** Batch into a single upsert using an array payload. Supabase supports bulk upsert via `supabase.from().upsert([...])`:

```tsx
const updates = persistable.map((record) => ({
  id: record.id,
  sleep_score: record.sleep_score,
  score_breakdown: record.score_breakdown,
}));

if (updates.length > 0) {
  const { error } = await supabase
    .from('sleep_data')
    .upsert(updates, { onConflict: 'id' });

  if (error) {
    console.warn('[SleepStore] Batch score persist failed:', error.message);
  }
}
```

---

### BUG-009 · `activeIndex` initializes to `0` — FlatList renders at day 1 then jumps to today

**File:** `app/(tabs)/sleep.tsx`  
**Location:** `FlatList` `initialScrollIndex` and `activeIndex` state  

**Current code:**
```tsx
const [activeIndex, setActiveIndex] = useState(0); // always starts at 0
// ...
initialScrollIndex={activeIndex} // passes 0 on first render
```

The pager always starts at the first day of the month and immediately jumps to today via a `useEffect`, causing a visible flash.

**Required fix:** Compute the correct initial index synchronously during state initialization. Because `monthDates` is derived from `selectedDate` (which is initialized to today), compute the index at the same time:

```tsx
const [activeIndex, setActiveIndex] = useState<number>(() => {
  const today = normalizeDate(new Date());
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  // Today's index = today's date - 1 (0-indexed)
  return Math.min(today.getDate() - 1, lastDay - 1);
});
```

This assumes `selectedDate` initializes to today (it does). The `useEffect` that scrolls to index can then check if already at the correct position before scrolling:

```tsx
useEffect(() => {
  const index = monthDates.findIndex((d) => isSameDay(d, selectedDate));
  if (index >= 0 && index !== activeIndex) {
    pagerRef.current?.scrollToIndex({ index, animated: true });
    setActiveIndex(index);
  }
}, [selectedDate, monthDates]);
```

---

### BUG-010 · `inFlightRanges` is a module-level singleton — persists across user sessions

**File:** `store/sleepStore.ts`  
**Location:** Top of file  

**Current code:**
```tsx
const inFlightRanges = new Set<string>(); // module-level singleton
```

After logout and login with a different account, stale in-flight keys remain in the set. Subsequent fetches for those ranges will silently be skipped. This is a multi-account data isolation issue.

**Required fix:** Move `inFlightRanges` inside the store state or clear it on auth state change. Simplest approach — clear on `fetchSleepData` entry:

```tsx
// At the top of fetchSleepData action:
inFlightRanges.clear();
```

Alternatively, convert to a store state field `inFlightRanges: Set<string>` and reset it in a `resetStore` action called on logout.

---

### BUG-011 · `durationHoursValue` displays "7.50 hr" — not human-readable time format

**File:** `app/(tabs)/sleep.tsx`  
**Location:** ~line 165  

**Current code:**
```tsx
const durationHoursValue = durationMinutes ? formatHours(durationMinutes, 2) : '--';
// formatHours(450, 2) → "7.50"
// Displayed in MetricCard as "7.50 hr"
```

**Required fix:** Use `formatDuration` from `lib/sleepFormatters.ts` which returns `{ h, m }`, then compose a display string:

```tsx
const durationParts = durationMinutes ? formatDuration(durationMinutes) : null;
const durationHoursValue = durationParts
  ? durationParts.m > 0
    ? `${durationParts.h}h ${durationParts.m}m`
    : `${durationParts.h}h`
  : '--';
```

Remove `unit` prop from the Total Sleep metric card since the unit is now embedded in the value string, or pass `unit={undefined}`.

---

## 🟡 MODERATE — P2

### BUG-012 · `cachedHistory` self-dependency causes infinite effect loop risk

**File:** `app/(tabs)/sleep.tsx`  
**Location:** Cache population `useEffect`  

**Current code:**
```tsx
useEffect(() => {
  // reads cachedHistory
  // calls setCachedHistory
}, [cacheRange, monthDates, historyByDate, cachedHistory]); // ← cachedHistory is a dep
```

The size guard (`next.size !== cachedHistory.size`) prevents a true infinite loop today, but any refactor that changes the guard condition breaks this. The pattern is fragile.

**Required fix:** Use a ref to track which keys have been populated, separate from the rendered state:

```tsx
const populatedKeysRef = useRef<Set<string>>(new Set());

useEffect(() => {
  let hasNew = false;
  const next = new Map(cachedHistory);
  
  for (let i = cacheRange.min; i <= cacheRange.max; i++) {
    const date = monthDates[i];
    if (!date) continue;
    const key = dateKey(date);
    if (populatedKeysRef.current.has(key)) continue;
    
    const record = historyByDate.get(key) ?? null;
    next.set(key, record);
    populatedKeysRef.current.add(key);
    hasNew = true;
  }

  if (hasNew) setCachedHistory(next);
}, [cacheRange, monthDates, historyByDate]); // ← cachedHistory removed from deps
```

When `historyByDate` updates with new records, clear `populatedKeysRef` for the affected keys to allow re-population:

```tsx
useEffect(() => {
  // When historyByDate changes, invalidate populated keys that have real data now
  historyByDate.forEach((_, key) => {
    populatedKeysRef.current.delete(key);
  });
}, [historyByDate]);
```

---

### BUG-013 · Two redundant `useEffect` blocks both manage `cacheRange`

**File:** `app/(tabs)/sleep.tsx`  
**Location:** Two separate `cacheRange` effects  

Both effects fire on `activeIndex` changes and do overlapping work — the first sets the initial range and would reset it on every mount, the second expands it. They trigger two separate state updates and two renders per swipe.

**Required fix:** Consolidate into one effect:

```tsx
useEffect(() => {
  if (!monthDates.length) return;
  setCacheRange((prev) => {
    const newMin = Math.max(0, activeIndex - 4);
    const newMax = Math.min(monthDates.length - 1, activeIndex + 4);
    if (newMin === prev.min && newMax === prev.max) return prev;
    return { min: newMin, max: newMax };
  });
}, [activeIndex, monthDates.length]);
```

---

### BUG-014 · `monthlyData` state grows unbounded — no eviction policy

**File:** `store/sleepStore.ts`  
**Location:** `monthlyData` state, populated in `fetchMonthHistory` and `fetchSleepDataRange`  

Every month navigated by the user is fetched and added to the in-memory `monthlyData` Record. After browsing 12 months, state holds 365 records plus JSON score breakdowns. No cleanup.

**Required fix:** Add an LRU eviction when writing to `monthlyData`. Cap at 4 months:

```tsx
const MAX_CACHED_MONTHS = 4;

// Helper to apply after any monthlyData write:
function evictOldMonths(data: Record<string, SleepData[]>): Record<string, SleepData[]> {
  const keys = Object.keys(data).sort().reverse(); // newest first
  if (keys.length <= MAX_CACHED_MONTHS) return data;
  const evicted = { ...data };
  keys.slice(MAX_CACHED_MONTHS).forEach((k) => delete evicted[k]);
  return evicted;
}

// Apply in set() calls that write monthlyData:
set((state) => ({
  monthlyData: evictOldMonths({ ...state.monthlyData, [key]: scoredRecords }),
}));
```

---

### BUG-015 · `weeklyHistory` name is misleading — stores up to 30 records

**File:** `store/sleepStore.ts`, `app/(tabs)/sleep.tsx`, `components/sleep/SleepCalendar.tsx`  
**Location:** `SleepState` interface, all usages  

`weeklyHistory` is named, typed, and documented as weekly data but stores 30 days. Every consumer makes incorrect assumptions about the data window.

**Required fix:**
1. Rename `weeklyHistory` → `recentHistory` in `SleepState` interface
2. Update `set({ weeklyHistory: ... })` → `set({ recentHistory: ... })` throughout `sleepStore.ts`
3. Update all destructuring in `sleep.tsx`: `const { recentHistory, ... } = useSleepStore()`
4. Update `SleepCalendar.tsx` prop `history={weeklyHistory}` → `history={recentHistory}`
5. Update the `SleepCalendarProps` interface if `history` is typed based on the prop name

---

### BUG-016 · `padToSeven` is defined in two places

**File:** `app/(tabs)/sleep.tsx` (top of file) and `store/sleepStore.ts`  

**Required fix:**
1. Move the canonical version to `lib/sleepDateUtils.ts` with this signature:
```tsx
export const padToSeven = <T>(values: T[], fill: T): T[] => {
  if (values.length >= 7) return values.slice(-7);
  return Array(7 - values.length).fill(fill).concat(values);
};
```
2. Remove local definitions from both files
3. Import from `@lib/sleepDateUtils` where needed

---

### BUG-017 · `metricCards` passes `selectedDate` twice per card

**File:** `app/(tabs)/sleep.tsx`  
**Location:** `metricCards` useMemo  

```tsx
{
  dataDate: selectedDate,
  selectedDate,       // same reference, same value
}
```

`MetricCard`'s `arePropsEqual` compares both fields independently. Removing the redundant prop reduces comparison overhead and clarifies the API.

**Required fix:** Remove `dataDate` from all metric card entries and use only `selectedDate`. Update `MetricCardProps` in `components/sleep/MetricCard.tsx` to remove `dataDate` prop if it is always equal to `selectedDate`. If they can differ (data from a different day than the currently selected day), document the difference explicitly.

---

### BUG-018 · `handlePagerEnd` is not memoized — new reference on every render

**File:** `app/(tabs)/sleep.tsx`  

**Current code:**
```tsx
const handlePagerEnd = (offsetX: number) => { ... }; // recreated every render
```

**Required fix:**
```tsx
const handlePagerEnd = useCallback((offsetX: number) => {
  const index = Math.round(offsetX / SCREEN_W);
  const next = monthDates[index];
  if (next && !isSameDay(next, selectedDate)) {
    setSelectedDate(next);
    setActiveIndex(index);
  }
  const nextKey = next ? dateKey(next) : gradientKey;
  setGradientKey(nextKey, true);
  navigation.getParent()?.setOptions({ swipeEnabled: true });
}, [monthDates, selectedDate, gradientKey, setGradientKey, navigation]);
```

---

### BUG-019 · Circular slider — start knob always wins when knobs overlap

**File:** `components/sleep/AddSleepRecordModal.tsx`  
**Location:** `sliderGesture` `onTouchesDown` handler  

**Current code:**
```tsx
if (dS <= threshold && dS <= dE) {
  activeKnob.value = 'start'; // start always wins ties
```

When both knobs are at or near the same angle, the end knob can never be selected.

**Required fix:** When both knobs are within threshold and at equal distance, prefer the end knob (it's more commonly adjusted after setting bedtime) or track which was last interacted with:

```tsx
const lastKnob = useSharedValue<'start' | 'end'>('end');

// In onTouchesDown:
if (dS <= threshold && dE <= threshold) {
  // Both in range — prefer the one NOT last touched (toggle behavior)
  activeKnob.value = lastKnob.value === 'start' ? 'end' : 'start';
  state.activate();
} else if (dS <= threshold) {
  activeKnob.value = 'start';
  state.activate();
} else if (dE <= threshold) {
  activeKnob.value = 'end';
  state.activate();
}

// In onFinalize:
if (activeKnob.value !== null) {
  lastKnob.value = activeKnob.value;
}
activeKnob.value = null;
```

---

### BUG-020 · No minimum duration validation in `AddSleepRecordModal`

**File:** `components/sleep/AddSleepRecordModal.tsx`  
**Location:** `handleSave`  

Zero-duration or near-zero sleep can be saved silently if the user accidentally leaves both knobs at the same position.

**Required fix:** Add a minimum duration guard before save:

```tsx
const handleSave = async () => {
  if (isSaving || !userId) return;

  // Compute duration before proceeding
  let diff = endAngle.value - startAngle.value;
  if (diff <= 0) diff += TAU;
  const durMins = Math.round(((diff / TAU) * 24 * 60) / 10) * 10;

  if (durMins < 30) {
    // Show inline error — do not use Alert (modal already open)
    setValidationError('Sleep duration must be at least 30 minutes.');
    return;
  }

  setValidationError(null);
  setIsSaving(true);
  // ... rest of existing logic
};
```

Add `validationError` state and render it above the Save button:
```tsx
{validationError && (
  <Text style={styles.validationError}>{validationError}</Text>
)}
```

Add to StyleSheet:
```tsx
validationError: {
  color: '#FF6B6B',
  fontSize: 13,
  textAlign: 'center',
  marginBottom: 8,
},
```

---

## 🔵 MINOR — P3

### BUG-021 · `monthlyData` type should be `Partial<Record<...>>` — optional chaining is inconsistent

**File:** `store/sleepStore.ts`, `app/(tabs)/sleep.tsx`  

**Current type:**
```tsx
monthlyData: Record<string, SleepData[]>; // implies all keys always exist
```

**Usage:**
```tsx
const monthRecords = monthlyData?.[monthKey]; // optional chaining contradicts type
```

**Fix:** Change the type to `Partial<Record<string, SleepData[]>>` and remove the optional chaining inconsistency — or remove the optional chaining and guarantee initialization with `{}`. Pick one.

---

### BUG-022 · `calculateSleepScore` name collision between two modules

**Files:** `store/sleepStore.ts` import section  

```tsx
import { calculateSleepScore as calculateDynamicSleepScore } from '@lib/sleepAnalysis';
// + calculateQualityFromDuration from '@lib/sleepCalculations' which internally calls calculateSleepScore
```

Two functions share the base name `calculateSleepScore` in different modules, aliased to avoid collision. The legacy one in `sleepCalculations.ts` should be renamed to `calculateLegacySleepScore` with a `@deprecated` JSDoc tag directing consumers to `sleepAnalysis.ts`.

---

### BUG-023 · `removeClippedSubviews` on paginated horizontal FlatList risks blank pages

**File:** `app/(tabs)/sleep.tsx`  
**Location:** FlatList props  

```tsx
removeClippedSubviews  // dangerous on paginated horizontal lists with animations
```

When swiping quickly across multiple pages, the previous page's content may be unmounted by `removeClippedSubviews` before the momentum animation completes, resulting in a blank white frame visible during fast swipes.

**Fix:** Remove `removeClippedSubviews` from the horizontal date pager. It provides negligible memory benefit for a month-length list (max 31 items) and is specifically known to cause issues with React Native FlatList in paginated horizontal mode.

---

### BUG-024 · `onTouchStart` and `onScrollBeginDrag` both disable parent swipe — doubled

**File:** `app/(tabs)/sleep.tsx`  
**Location:** FlatList event handlers  

```tsx
onScrollBeginDrag={() => navigation.getParent()?.setOptions({ swipeEnabled: false })}
onTouchStart={() => navigation.getParent()?.setOptions({ swipeEnabled: false })}
```

`onTouchStart` fires on every tap, not just scroll attempts. A tap on a date cell disables the parent tab navigator's swipe gesture, which is only re-enabled in `onTouchEnd` — but if `onTouchEnd` fires slightly before `onMomentumScrollEnd`, there's a race where the parent swipe gets re-enabled mid-scroll.

**Fix:** Remove `onTouchStart` and `onTouchEnd`. `onScrollBeginDrag` + `onMomentumScrollEnd` + `onScrollEndDrag` is the correct and sufficient pair for this pattern.

---

## ARCHITECTURE NOTES FOR AGENT

These are not individual bug fixes — they are structural improvements to plan as follow-up work items. Do not implement during this audit pass.

### ARCH-001 · `sleep.tsx` should be decomposed (600+ lines)

Extract:
- `SleepPagerHeader` — the horizontal date FlatList + header icons
- `SleepDataSheet` — bottom sheet with metrics or empty state
- `useSleepPageState` — custom hook owning `selectedDate`, `activeIndex`, `cacheRange`, `cachedHistory`

Keep `SleepScreen` as a thin orchestrator.

### ARCH-002 · Triple source of truth for sleep data

`weeklyHistory`, `monthlyData`, and `cachedHistory` (component state) all store overlapping data with different merge strategies. The canonical solution is to move all data resolution into the store and expose a single `getRecordForDate(date: Date): SleepData | null` selector. The component-level `cachedHistory` Map should be removed.

### ARCH-003 · Score breakdown stored in Supabase as JSON column

`score_breakdown: ScoreBreakdown` is a large nested object persisted per record. For records updated daily, this creates significant write amplification. Consider storing the score integer only in `sleep_data` and persisting breakdowns to a separate `sleep_score_breakdowns` table keyed by `sleep_data.id`. Breakdowns are only needed for the detail view, not list views.

---

## RECOMMENDED AGENT TOOLING NOTE

For **Claude Code** users: this document is structured for direct use with `claude --print` in non-interactive mode or as a task list in interactive mode. Each `BUG-XXX` section is a self-contained work unit. Suggested invocation pattern:

```bash
# Work one tier at a time
claude "Read SLEEP_SCREEN_AUDIT.md. Implement all P0 (CRITICAL) bugs only. 
After each fix, confirm the file compiles. Do not proceed to P1 until all P0 are done."
```

For **agentic coding tools** (Cursor, Copilot Workspace, etc.): use the `### BUG-XXX` headers as individual task prompts. Each section contains sufficient context to execute independently.

**Relevant skills if using Claude.ai Computer Use or a skill-based agent framework:**
- No existing skill in `/mnt/skills/public/` directly covers React Native bug remediation.
- If you plan to run this as a repeated audit process (e.g., monthly), consider creating a custom skill using the **`skill-creator`** framework at `/mnt/skills/examples/skill-creator/SKILL.md`. A `react-native-audit` skill could encode your project's conventions (OLED dark theme, optical radius rules, Zustand patterns, Reanimated worklet constraints) so future audit passes are automatically context-aware without re-reading all source files.

---

## COMPLETION CHECKLIST

| ID | Severity | Description | Done |
|---|---|---|---|
| BUG-001 | 🔴 P0 | Replace hardcoded description with score-derived text | ☐ |
| BUG-002 | 🔴 P0 | Fix sleep efficiency calculation (TST / TIB) | ☐ |
| BUG-003 | 🔴 P0 | Fix cachedHistory null-lock bug | ☐ |
| BUG-004 | 🔴 P0 | Fix buttons losing pointer events after 2px scroll | ☐ |
| BUG-005 | 🔴 P0 | Fix optimistic update rollback in forceSaveManualSleep | ☐ |
| BUG-006 | 🟠 P1 | Add iOS cloud fetch cooldown | ☐ |
| BUG-007 | 🟠 P1 | Pass real profile fields to scoring engine | ☐ |
| BUG-008 | 🟠 P1 | Batch Supabase score persistence | ☐ |
| BUG-009 | 🟠 P1 | Fix FlatList initial scroll flash | ☐ |
| BUG-010 | 🟠 P1 | Clear inFlightRanges on fetchSleepData entry | ☐ |
| BUG-011 | 🟠 P1 | Fix duration display format (7h 30m not 7.50 hr) | ☐ |
| BUG-012 | 🟡 P2 | Remove self-dep from cachedHistory effect | ☐ |
| BUG-013 | 🟡 P2 | Consolidate duplicate cacheRange effects | ☐ |
| BUG-014 | 🟡 P2 | Add monthlyData LRU eviction (cap 4 months) | ☐ |
| BUG-015 | 🟡 P2 | Rename weeklyHistory → recentHistory everywhere | ☐ |
| BUG-016 | 🟡 P2 | Deduplicate padToSeven into sleepDateUtils | ☐ |
| BUG-017 | 🟡 P2 | Remove redundant dataDate prop from metric cards | ☐ |
| BUG-018 | 🟡 P2 | Wrap handlePagerEnd in useCallback | ☐ |
| BUG-019 | 🟡 P2 | Fix circular slider knob overlap selection | ☐ |
| BUG-020 | 🟡 P2 | Add 30-minute minimum validation to AddSleepRecordModal | ☐ |
| BUG-021 | 🔵 P3 | Fix monthlyData type inconsistency | ☐ |
| BUG-022 | 🔵 P3 | Rename legacy calculateSleepScore to avoid collision | ☐ |
| BUG-023 | 🔵 P3 | Remove removeClippedSubviews from horizontal pager | ☐ |
| BUG-024 | 🔵 P3 | Remove doubled touch/scroll parent-swipe disablers | ☐ |

---

*End of audit document. Total issues: 24 bugs across 5 files, 3 architectural notes.*
