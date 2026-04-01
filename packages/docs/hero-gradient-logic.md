# Sleep Hero Gradient Logic (Current Implementation)

This document describes how the Sleep Hero background gradient is currently implemented in the app.

## Source of Truth

- Component: `apps/mobile/components/sleep/redesign/SleepHero.tsx`
- Theme presets: `apps/mobile/constants/theme.ts` (`SLEEP_THEME.heroGradePresets`)
- Parent container overflow chain: `apps/mobile/app/(tabs)/sleep.tsx` (`styles.heroLayer`)

## Rendering Model

The hero uses **2 SVG gradient layers** rendered full-screen:

1. **Radial base layer**
   - `cx="18%"`, `cy="9%"`
   - `rx="88%"`, `ry="92%"`
   - Stops:
     - `0%`: `preset.primary`, opacity `1`
     - `70%`: `preset.mid`, opacity `1`
     - `100%`: `#000000`, opacity `1`

2. **Linear overlay layer**
   - `x1="0%"`, `y1="0%"`, `x2="0%"`, `y2="100%"`
   - Stops:
     - `0%`: `preset.overlayStart`, opacity `0.8`
     - `61%`: `#000000`, opacity `0.1`

Both layers are drawn as full-screen `<Rect />` fills and stacked in this order:
- radial rect first
- linear overlay rect second

The SVG uses `height={SCREEN_HEIGHT}` where `SCREEN_HEIGHT = Dimensions.get('window').height`.

## State + Animation Flow

The hero gradient uses a **cross-fade between presets**:

- `basePreset`: current visible preset
- `overlayPreset`: next preset during transition
- `overlayOpacity`: Reanimated shared value

When grade/preset changes:

1. `overlayPreset` is set to the target preset
2. `overlayOpacity` animates `0 -> 1` over `600ms` (`Easing.out(Easing.cubic)`)
3. On animation finish:
   - `basePreset = targetPreset`
   - `overlayOpacity` reset to `0`

This creates a smooth color transition without hard cuts.

## Preset Selection Logic

- If screen is empty (`score === undefined`), use `heroGradePresets.Empty`.
- Otherwise map `grade` string to `heroGradePresets[grade]`.
- Fallback grade preset is `heroGradePresets.Great` if key is not found.

## Current Color Presets

From `SLEEP_THEME.heroGradePresets`:

| Preset | primary | mid | end | overlayStart | overlayEnd |
|---|---|---|---|---|---|
| Excellent | `#7937E3` | `#230F43` | `#05020B` | `#7937E3` | `#140924` |
| Great | `#139645` | `#133D26` | `#03110A` | `#139645` | `#0A1E13` |
| Good | `#436111` | `#042B07` | `#020E03` | `#436111` | `#0A1606` |
| Fair | `#F48414` | `#74491E` | `#180C04` | `#F48414` | `#221307` |
| Poor | `#FF304E` | `#682C35` | `#18070B` | `#FF304E` | `#220D12` |
| Bad | `#CD0A24` | `#420910` | `#150306` | `#CD0A24` | `#1C0509` |
| Terrible | `#C01010` | `#510C0C` | `#190505` | `#C01010` | `#220808` |
| Empty | `#3A3A3D` | `#1E1E21` | `#000000` | `#54545A` | `#09090B` |

## Layout/Overflow Requirements (Android)

To allow the full-screen gradient to bleed below the hero area:

- `SleepHero.styles.hero` uses `overflow: 'visible'`
- `sleep.tsx -> styles.heroLayer` uses `overflow: 'visible'`

Without this chain, Android may clip the gradient to hero bounds.

## Notes

- `overlayEnd` is currently part of presets but not directly used in the SVG stop definitions.
- The hero background `View` itself is transparent; color comes from SVG layers.
