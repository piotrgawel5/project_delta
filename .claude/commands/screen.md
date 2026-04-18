# /screen $ARGUMENTS

Scaffold a new screen in Project Delta:

**$ARGUMENTS**

## Before Creating Anything

1. Read `apps/mobile/CLAUDE.md` for current directory structure and conventions
2. Read `apps/mobile/constants/theme.ts` for SLEEP_THEME, SLEEP_LAYOUT, SLEEP_FONTS tokens
3. Read `packages/docs/mobile/screens.md` for existing screen patterns
4. Confirm the route path in `apps/mobile/app/` (Expo Router file-based)

## File Scaffold

For a screen at route `(tabs)/sleep`:

```
apps/mobile/app/(tabs)/<name>.tsx         → Screen component (Expo Router route)
apps/mobile/components/<feature>/         → Feature-specific components
apps/mobile/lib/<feature>Utils.ts         → Pure logic (if needed)
```

## Screen Template

```tsx
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SLEEP_THEME, SLEEP_LAYOUT } from '@constants';

export default function $ARGUMENTSScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SLEEP_THEME.screenBg }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
          paddingBottom: SLEEP_LAYOUT.scrollBottomPad,
        }}
      >
        {/* Content */}
      </ScrollView>
    </SafeAreaView>
  );
}
```

## Constraints

- Colors from `SLEEP_THEME` only — zero hardcoded hex
- Spacing from `SLEEP_LAYOUT` — zero magic numbers
- Fonts from `SLEEP_FONTS` — DMSans only
- Corner radii derived: `SLEEP_LAYOUT.cardRadiusOuter` for outer, `SLEEP_LAYOUT.cardRadiusInner` for inner
- Animations: Reanimated 4 only
- Data fetching: via Zustand store, not inline `useEffect` waterfall
- Bottom sheets: `@gorhom/bottom-sheet` only
- Images: `expo-image` only
- Blur/glass: `expo-blur` `BlurView` only

## Validation

```bash
cd apps/mobile && npm run lint
npx tsc --noEmit -p apps/mobile/tsconfig.json
```
