---
name: mobile-quality-standard
description: >
  Performance, design fidelity, and fetch architecture standards for Project Delta
  (Expo React Native, TypeScript, Zustand, Expo Router, NativeWind).
  Apply to every task touching apps/mobile/. Violations here produce visual regressions,
  FPS drops, or waterfall fetches — all of which require expensive remediation.
allowed-tools: Read,Write(apps/mobile/**),Bash(npx jest apps/mobile/lib/__tests__*),Bash(cd apps/mobile && npm run lint),Bash(npx tsc --noEmit*)
---

# Project Delta — Mobile Quality Standard

## Pre-Task Checklist

Before writing code, verify:

```
[ ] Read apps/mobile/constants/theme.ts — source of truth for colors, spacing, fonts
[ ] Read packages/docs/context.md — architecture and conventions
[ ] If task touches Figma reference: read apps/mobile/reference_assets/[screen].png
[ ] Declare: "I have read theme.ts and reference assets: [list]"
```

---

## 1. Color System — Non-Negotiable

### ✗ Forbidden Patterns

```ts
// NEVER use Tailwind slate-* classes
className="bg-slate-900 text-slate-400 border-slate-700"

// NEVER hardcode hex values
style={{ backgroundColor: '#1e293b' }}

// NEVER use arbitrary colors from memory
backgroundColor: 'rgb(100, 120, 140)'
```

### ✓ Required Pattern

```ts
import { SLEEP_THEME } from '@/constants/theme';

// Use token names, not raw hex
style={{ backgroundColor: SLEEP_THEME.colors.background }}
className="text-[color:rgb(var(--color-text-primary))]"
```

### Grade Colors (Sleep Quality)

```ts
import { SLEEP_THEME } from '@constants';

// Grade → gradient stop colors
const { primary, mid, end, overlayStart } = SLEEP_THEME.heroGradePresets[grade];
// grade: 'Excellent' | 'Great' | 'Good' | 'Fair' | 'Poor' | 'Bad' | 'Terrible' | 'Empty'

// Zone bar indicators
SLEEP_THEME.zoneBarGreat   // #30D158 green
SLEEP_THEME.zoneBarFair    // #FF9F0A amber
SLEEP_THEME.zoneBarLow     // #FF453A red

// Hypnogram stage colors (use sleepHypnogramColors, not hardcoded)
import { sleepHypnogramColors } from '@constants';
sleepHypnogramColors.deep   // #6d2cf3
sleepHypnogramColors.rem    // #3bd6c9
sleepHypnogramColors.core   // #4aa3ff
sleepHypnogramColors.awake  // #ff8a00
```

---

## 2. Design Token Compliance

### Spacing & Layout

```ts
import { SLEEP_LAYOUT } from '@/constants/theme';

// ✓ Correct
style={{ 
  padding: SLEEP_LAYOUT.cardPadding, 
  borderRadius: SLEEP_LAYOUT.cardRadius 
}}

// ✗ Forbidden — magic numbers
style={{ padding: 16, borderRadius: 12 }}
```

### Corner Radii — Optical Rule (Enforced)

```ts
// Outer radius MUST equal inner radius + padding
const innerRadius = SLEEP_LAYOUT.innerCardRadius;
const outerRadius = innerRadius + SLEEP_LAYOUT.cardPadding;

// ✗ Forbidden — same value causes optical misalignment
borderRadius: 16  // both parent and child = wrong
```

### Typography — DMSans Only

```ts
import { SLEEP_FONTS } from '@/constants/theme';

style={{ fontFamily: SLEEP_FONTS.regular }}      // DMSans-Regular
style={{ fontFamily: SLEEP_FONTS.medium }}       // DMSans-Medium
style={{ fontFamily: SLEEP_FONTS.semiBold }}     // DMSans-SemiBold
style={{ fontFamily: SLEEP_FONTS.bold }}         // DMSans-Bold

// ✗ Forbidden
style={{ fontFamily: 'System' }}
style={{ fontFamily: 'Inter' }}
```

---

## 3. Animation — Reanimated Only (UI Thread)

### ✓ Correct Pattern

```ts
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming 
} from 'react-native-reanimated';

const opacity = useSharedValue(0);
const animatedStyle = useAnimatedStyle(() => ({ 
  opacity: opacity.value 
}));

opacity.value = withTiming(1, { duration: 300 });
```

### ✗ Forbidden — JS Thread Animated

```ts
// JS thread = FPS drops, stutter
const opacity = useRef(new Animated.Value(0)).current;
Animated.timing(opacity, { toValue: 1, useNativeDriver: false }).start();
```

### FPS Standards

- **Target:** 120fps (high-refresh devices)
- **Minimum acceptable:** 118fps on Samsung Galaxy A-series (mid-range)
- **Measure with:** Flipper or Expo DevTools profiler before marking complete

### GPU Compositing

```ts
// Android
style={{ renderToHardwareTextureAndroid: true }}

// iOS
style={{ shouldRasterizeIOS: true }}
```

### ✗ Never Animate These Properties

```ts
// These trigger layout passes → FPS drop
width, height, padding, margin

// ✓ Use transform instead
style={{ transform: [{ scale: 1.2 }] }}
style={{ transform: [{ translateY: 10 }] }}
```

---

## 4. SVG Rendering — Critical Bug

### ✗ Broken Pattern

```ts
// Gradient on vertical lines: zero-width bounding box collapse
<Line 
  x1={x} y1={y1} x2={x} y2={y2} 
  stroke="url(#gradient)" 
  strokeWidth={4} 
/>
```

### ✓ Correct Pattern

```ts
// Use Rect with fill instead
<Rect
  x={x - strokeWidth / 2}
  y={Math.min(y1, y2)}
  width={strokeWidth}
  height={Math.abs(y2 - y1)}
  fill="url(#linearGrad)"
/>
```

---

## 5. Fetch Architecture — No Waterfall

### ✗ Forbidden Pattern (Waterfall)

```ts
useEffect(() => { fetchUser() }, []);
useEffect(() => { fetchSleepData() }, [userId]);
useEffect(() => { fetchTimeline() }, [sleepDataId]);
useEffect(() => { fetchInsights() }, [sleepDataId]);
// Result: 4+ sequential requests, visible loading cascade
```

### ✓ Correct Pattern (Batch via Zustand)

```ts
// In store (apps/mobile/store/):
const useSleepStore = create<SleepState>((set, get) => ({
  data: null,
  isLoaded: false,

  fetchAll: async (userId: string, date: string) => {
    if (get().isLoaded) return;  // ← cache guard
    
    const [sleepData, timeline, insights] = await Promise.all([
      api.getSleepData(userId, date),
      api.getSleepTimeline(userId, date),
      api.getInsights(userId, date),
    ]);
    
    set({ data: { sleepData, timeline, insights }, isLoaded: true });
  },
}));

// In component: one call, parallel internally, cached on repeat
useEffect(() => {
  store.fetchAll(userId, date);
}, [userId, date]);
```

### Cache Invalidation

Invalidate (set `isLoaded: false`) **only** when:
- User manually edits sleep data
- User navigates to new date
- User pulls-to-refresh

**Never** invalidate on unmount, remount, or navigation stack changes.

---

## 6. Re-render Discipline

### ✓ Always Memoize Derived Values

```ts
const sleepGrade = useMemo(() => deriveSleepGrade(score), [score]);
```

### ✓ Always Memoize Callbacks

```ts
const handlePress = useCallback(() => {
  navigation.navigate('SleepAnalysis');
}, [navigation]);
```

### ✓ Use Zustand Selectors (Never Full Store)

```ts
// ✗ Wrong — re-renders on ANY store change
const store = useSleepStore();

// ✓ Correct — only re-renders when score changes
const score = useSleepStore((s) => s.data?.sleepData?.score);
const isLoaded = useSleepStore((s) => s.isLoaded);
```

### ✓ Memoize List Items

```ts
const SleepSessionCard = React.memo(({ session }: Props) => { ... });

<FlatList
  keyExtractor={(item) => item.id}
  getItemLayout={(_, index) => ({ 
    length: ITEM_HEIGHT, 
    offset: ITEM_HEIGHT * index, 
    index 
  })}
/>
```

---

## 7. Design Fidelity Checklist

Before marking UI task complete:

```
[ ] All colors from SLEEP_THEME or NEON_COLORS — zero slate-* classes
[ ] All spacing from SLEEP_LAYOUT tokens — zero magic numbers
[ ] Corner radii derived (outer = inner + padding)
[ ] Typography uses DMSans via SLEEP_FONTS
[ ] Figma reference checked — layout proportions match exactly
[ ] No element is "close enough" — if spec shows pill badge, code has pill badge
[ ] SVG gradients use Rect, not Line stroke
[ ] No SVG filters on animated elements (use geometric approximation)
```

---

## 8. Anti-Patterns (Immediate Failure)

| Pattern | Why it fails |
|---------|-------------|
| `slate-*` Tailwind classes | Wrong color, breaks design system |
| `useNativeDriver: false` | JS thread, FPS drop |
| SVG filter blur/glow on animation | JS thread, severe FPS drop |
| `Line stroke="url()"` vertical | Zero-width bounding box, invisible |
| Multiple `useEffect` fetches on mount | Waterfall, visible loading |
| Full Zustand store subscription | Unwanted re-renders |
| Same `borderRadius` on nested elements | Optical corner mismatch |
| Hardcoded hex not from `theme.ts` | Breaks dark mode, consistency |
| Animating `width`/`height`/`padding` | Triggers layout pass, FPS drop |
| `setInterval` driving animation | JS thread, unreliable |

---

## 9. Component Conventions

```ts
// Bottom sheets: @gorhom/bottom-sheet ONLY
import BottomSheet from '@gorhom/bottom-sheet';

// Blur/frosted glass: expo-blur BlurView ONLY
import { BlurView } from 'expo-blur';

// Images: expo-image ONLY (better caching than RN Image)
import { Image } from 'expo-image';

// Icons: single consistent icon library per feature
// Navigation: Expo Router file-based (no manual NavigationContainer)
// Offline writes: Zustand → async-storage queue → batch POST /sleep/sync-batch
// Never write directly to Supabase from components
```

---

## 10. Task Completion Validation

```
[ ] cd apps/mobile && npm run lint — zero errors
[ ] npx tsc --noEmit (from apps/mobile/) — zero errors
[ ] No console.warn or console.error in touched files
[ ] All animations verified Reanimated (not JS-thread Animated)
[ ] Grep 'slate-' in touched files — result must be empty
[ ] No new useEffect waterfall introduced
[ ] Zustand selectors used (not full store)
[ ] Reference asset compared — proportions match
[ ] Corner radii derived, not hardcoded
```

---

## Using This Skill in Claude Code

Reference in prompts:
```
Review this component against mobile-quality-standard (focus on colors, re-renders)
```

Or explicitly invoke during code review:
```
/mobile-quality-standard
```

Claude will load this context automatically when working on apps/mobile/.
