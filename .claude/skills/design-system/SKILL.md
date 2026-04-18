---
name: design-system
description: >
  OLED-black UI design system for Project Delta mobile screens.
  Apply whenever building or modifying any screen, card, bottom sheet, or modal in apps/mobile/.
  Defines surfaces, typography, card anatomy, bottom sheet shell, keyboard avoidance, animation,
  and color discipline. Sleep and Account screens are the canonical reference implementations.
allowed-tools: Read,Write(apps/mobile/**),Bash(npx tsc --noEmit*),Bash(cd apps/mobile && npm run lint)
---

# Project Delta — OLED-Black Design System

Reference implementations:
- `apps/mobile/app/(tabs)/sleep.tsx` + `apps/mobile/components/sleep/redesign/*`
- `apps/mobile/app/(tabs)/account.tsx`
- `apps/mobile/components/profile/EditProfileModal.tsx`
- `apps/mobile/components/sleep/SleepCalendar.tsx`
- `apps/mobile/components/sleep/AddSleepRecordModal.tsx`

Token source of truth: `apps/mobile/constants/theme.ts`

---

## 1. Surface Hierarchy

Four OLED-optimized surfaces. Never mix levels or skip tiers.

| Level | Token | Value | Usage |
|-------|-------|-------|-------|
| Base | `SLEEP_THEME.screenBg` | `#000000` | Screen background, always |
| Sheet | `SLEEP_THEME.bottomSheetBg` | `#000000` | Bottom sheet surface |
| Card | `SLEEP_THEME.cardBg` | `#1C1C1E` | Cards, option rows, inputs |
| Elevated | `SLEEP_THEME.elevatedBg` | `#2C2C2E` | Icon containers, badges, close buttons |
| Inset | `SLEEP_THEME.cardInset` | `#232326` | Nested content wells inside cards |

```ts
import { SLEEP_THEME } from '@constants';

// ✓ Screen root
<View style={{ flex: 1, backgroundColor: SLEEP_THEME.screenBg }}>

// ✓ Card
<View style={{ backgroundColor: SLEEP_THEME.cardBg, borderRadius: SLEEP_LAYOUT.cardRadiusOuter }}>

// ✗ Never hardcode
<View style={{ backgroundColor: '#1C1C1E' }}>
```

---

## 2. Typography — DMSans Only

All text uses DMSans via `SLEEP_FONTS`. Never use System, Inter, Poppins, or `fontWeight` alone.

```ts
import { SLEEP_FONTS } from '@constants';

SLEEP_FONTS.regular   // DMSans-Regular  — body, hints, subtitles, edit links
SLEEP_FONTS.medium    // DMSans-Medium   — dates, secondary labels
SLEEP_FONTS.semiBold  // DMSans-SemiBold — row labels, section titles, badges
SLEEP_FONTS.bold      // DMSans-Bold     — screen titles, metric values, hero text
```

### Text color roles

```ts
SLEEP_THEME.textPrimary    // #FFFFFF — primary labels, row titles
SLEEP_THEME.textSecondary  // rgba(255,255,255,0.75) — secondary labels, back button
SLEEP_THEME.textMuted1     // #8E8E93 — section titles, stat labels
SLEEP_THEME.textMuted2     // #636366 — disabled button text
SLEEP_THEME.textDisabled   // rgba(255,255,255,0.4) — hints, edit links, placeholders
```

### Section title convention (ALL CAPS)

Every card section title follows this exact pattern:

```ts
<Text style={styles.sectionTitle}>PROFILE DETAILS</Text>

sectionTitle: {
  fontSize: 11,
  fontFamily: SLEEP_FONTS.semiBold,
  color: SLEEP_THEME.textMuted1,
  letterSpacing: 0.7,
  marginBottom: 12,
  textTransform: 'uppercase',
},
```

### Common size scale

| Size | Font | Usage |
|------|------|-------|
| 28+ | bold | Screen/sheet title |
| 22 | bold | Metric values, large labels |
| 15–16 | semiBold | Row labels, action titles |
| 13–14 | regular | Body copy, descriptions |
| 12 | regular | Hints, sublabels |
| 11 | semiBold | Section titles (ALL CAPS, letterSpacing 0.7) |

---

## 3. Card Anatomy

```ts
import { SLEEP_LAYOUT } from '@constants';

SLEEP_LAYOUT.cardRadiusOuter  // 20 — outer card radius
SLEEP_LAYOUT.cardRadiusInner  // 16 — inner radius (nested elements: icon containers, inputs)
SLEEP_LAYOUT.cardPadding      // 18 — internal padding
SLEEP_LAYOUT.cardGap          // 12 — gap between cards
SLEEP_LAYOUT.screenPaddingH   // 16 — horizontal screen padding
SLEEP_LAYOUT.scrollBottomPad  // 112 — ScrollView bottom padding (above nav bar)
```

### Card rules
- **No borders** — `SLEEP_THEME.cardBg` on `screenBg` provides sufficient contrast
- **No shadows** — OLED black makes shadows unnecessary
- **Gap, not margin** — use `gap: SLEEP_LAYOUT.cardGap` on the parent container
- **Outer = inner + padding** — never use the same radius for nested elements

```ts
// ✓ Correct card
card: {
  backgroundColor: SLEEP_THEME.cardBg,
  borderRadius: SLEEP_LAYOUT.cardRadiusOuter,  // 20
  padding: SLEEP_LAYOUT.cardPadding,           // 18
},

// ✓ Correct icon container inside card
iconContainer: {
  width: 44,
  height: 44,
  borderRadius: SLEEP_LAYOUT.cardRadiusInner,  // 16 — inner, not outer
  backgroundColor: SLEEP_THEME.elevatedBg,
},

// ✗ Wrong — border on card
card: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }

// ✗ Wrong — same radius nested
card: { borderRadius: 20 }
iconInCard: { borderRadius: 20 }  // must be 16 or less
```

---

## 4. Color Discipline — Monochromatic UI

UI chrome is monochromatic. Color signals meaning only.

### Icon containers
```ts
// ✓ Standard — white icon, grey container
optionIcon: {
  backgroundColor: SLEEP_THEME.elevatedBg,  // neutral grey
},
iconColor: SLEEP_THEME.textPrimary,         // white

// ✓ Danger — red is semantic
dangerIcon: {
  backgroundColor: 'rgba(255, 69, 58, 0.15)',
},
dangerColor: SLEEP_THEME.danger,            // red — signals destructive action

// ✗ Wrong — green accent on non-semantic UI chrome
optionIcon: { backgroundColor: 'rgba(48, 209, 88, 0.15)' }
```

### When color IS appropriate
- `SLEEP_THEME.success` (`#30D158`) — only for: active/enabled state badges, positive feedback, CTA buttons that confirm success actions
- `SLEEP_THEME.danger` (`#FF453A`) — destructive actions only (delete, remove, sign out)
- `SLEEP_THEME.warning` (`#FF9F0A`) — warnings only
- Grade/zone colors — data visualization only (sleep quality zones, hypnogram stages)

---

## 5. Bottom Sheet Pattern

The canonical shell for all modal overlays in this project. Used by `SleepCalendar`, `AddSleepRecordModal`, and `EditProfileModal`.

```ts
import { Modal, Dimensions, StyleSheet, Keyboard } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, runOnJS, Easing,
  interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_RADIUS = 44;
const SHEET_SPRING = { damping: 32, stiffness: 200, mass: 1.2 };
```

### Animation constants (copy exactly)

```ts
// Open:    withSpring(0, SHEET_SPRING)
// Close:   withTiming(SCREEN_HEIGHT, { duration: 375, easing: Easing.in(Easing.cubic) })
// Backdrop in:  withTiming(1, { duration: 420 })
// Backdrop out: withTiming(0, { duration: 330 })
// Snap-back: withSpring(0, { damping: 36, stiffness: 220, mass: 0.9 })
// Dismiss threshold: translateY > 120 || velocityY > 600
```

### Shell JSX structure

```tsx
<Modal visible={isVisible} transparent animationType="none" onRequestClose={closeWithAnimation}>
  <GestureHandlerRootView style={StyleSheet.absoluteFill}>
    {/* Backdrop — tap to close */}
    <Pressable style={StyleSheet.absoluteFill} onPress={closeWithAnimation}>
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      </Animated.View>
    </Pressable>

    {/* Sheet */}
    <GestureDetector gesture={sheetGesture}>
      <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }, sheetStyle]}>
        {/* Drag handle */}
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <View style={{ width: 36, height: 5, borderRadius: 2.5, backgroundColor: SLEEP_THEME.border }} />
        </View>
        {/* Content */}
      </Animated.View>
    </GestureDetector>
  </GestureHandlerRootView>
</Modal>
```

### Sheet style
```ts
sheet: {
  position: 'absolute',
  bottom: 0, left: 0, right: 0,
  backgroundColor: SLEEP_THEME.bottomSheetBg,   // #000000 — OLED black
  borderTopLeftRadius: SHEET_RADIUS,             // 44
  borderTopRightRadius: SHEET_RADIUS,
  paddingHorizontal: SLEEP_LAYOUT.cardPadding,   // 18
  paddingTop: 12,
},
```

---

## 6. Keyboard Avoidance in Bottom Sheets

Sheets with `TextInput` must translate above the keyboard. Use Reanimated `translateY` composition — do NOT use `KeyboardAvoidingView` inside a custom sheet.

```ts
import { Keyboard, Platform } from 'react-native';

const keyboardOffset = useSharedValue(0);

// Add inside the isVisible useEffect, after sheet open animation:
const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

const showSub = Keyboard.addListener(showEvent, (e) => {
  keyboardOffset.value = withTiming(-e.endCoordinates.height, { duration: 250 });
});
const hideSub = Keyboard.addListener(hideEvent, () => {
  keyboardOffset.value = withTiming(0, { duration: 200 });
});

return () => {
  showSub.remove();
  hideSub.remove();
};

// Compose with sheet translateY:
const sheetStyle = useAnimatedStyle(() => ({
  transform: [{ translateY: translateY.value + keyboardOffset.value }],
}));

// Always dismiss keyboard before close animation:
const closeWithAnimation = useCallback(() => {
  Keyboard.dismiss();
  // ... rest of close animation
}, []);
```

---

## 7. Animation Standards

All animations use Reanimated v4. Never use RN `Animated` (JS thread).

### Card entry — staggered FadeInDown
```tsx
import Animated, { FadeInDown } from 'react-native-reanimated';

<Animated.View entering={FadeInDown.duration(400).delay(220)} style={styles.card}>
<Animated.View entering={FadeInDown.duration(400).delay(270)} style={styles.card}>
<Animated.View entering={FadeInDown.duration(400).delay(320)} style={styles.card}>
```

### Press feedback — spring scale
```ts
const scale = useSharedValue(1);
const handlePressIn = () => { scale.value = withSpring(0.96, { damping: 15, stiffness: 200 }); };
const handlePressOut = () => { scale.value = withSpring(1, { damping: 15, stiffness: 200 }); };
```

### Rules
- Never animate `width`, `height`, `padding` — use `transform` only
- Target: 120fps. Minimum: 118fps on Samsung Galaxy A-series
- Haptics accompany meaningful press interactions: `Haptics.impactAsync(ImpactFeedbackStyle.Light)`

---

## 8. CTA Buttons

Primary CTA (confirm, save, submit):
```ts
saveButton: {
  backgroundColor: SLEEP_THEME.textPrimary,   // white
  height: 56,
  borderRadius: SLEEP_LAYOUT.cardRadiusOuter,  // 20
  justifyContent: 'center',
  alignItems: 'center',
},
saveButtonText: {
  fontSize: 15,
  fontFamily: SLEEP_FONTS.semiBold,
  color: SLEEP_THEME.screenBg,                 // black text on white
},

// Disabled state
saveButtonDisabled: { backgroundColor: SLEEP_THEME.elevatedBg },
saveButtonTextDisabled: { color: SLEEP_THEME.textMuted2 },
```

Destructive CTA (sign out, delete):
```ts
destructiveButton: {
  backgroundColor: 'rgba(255, 69, 58, 0.1)',
  borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
  height: 56,
},
destructiveText: {
  color: SLEEP_THEME.danger,
  fontFamily: SLEEP_FONTS.semiBold,
  fontSize: 15,
},
```

---

## 9. Edit Links

For secondary edit/action triggers that don't warrant a full button:

```ts
import * as Haptics from 'expo-haptics';

const handlePress = useCallback(() => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  onPress();
}, [onPress]);

<Pressable onPress={handlePress} style={{ alignSelf: 'center', paddingVertical: 8 }}>
  <Text style={{
    color: SLEEP_THEME.textDisabled,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 13,
    textDecorationLine: 'underline',
  }}>
    edit profile
  </Text>
</Pressable>
```

---

## 10. Checklist Before Marking UI Task Complete

```
[ ] All colors from SLEEP_THEME — zero hardcoded hex
[ ] All spacing/radii from SLEEP_LAYOUT — zero magic numbers
[ ] All fonts from SLEEP_FONTS — zero Inter/Poppins/System
[ ] Outer radius = inner + padding (never equal on nested elements)
[ ] Cards have no borders
[ ] Icon containers use elevatedBg (neutral), not colored tints, unless semantic
[ ] All animations use Reanimated — grep for 'new Animated.Value' must be empty in touched files
[ ] Sheets with TextInput have Keyboard listener + keyboardOffset
[ ] Section titles: ALL CAPS, 11px, semiBold, textMuted1, letterSpacing 0.7
[ ] npx tsc --noEmit — zero errors
[ ] cd apps/mobile && npm run lint — zero errors
```
