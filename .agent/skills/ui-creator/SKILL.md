---
name: ui-creator
description: Create modern Expo React Native UI for iOS and Android with strong visual identity, charts, navigation, and bottom sheets. Use when building or refining screens/components in apps/mobile with styling inspired by The Outsiders app plus contemporary iOS and One UI aesthetics, and when translating visual references into TS/TSX implementations.
---

# UI Creator

## Overview

Create production-ready TS/TSX UI implementations for the Expo React Native app in `apps/mobile`, using The Outsiders reference assets and modern iOS/One UI 8.5 cues.

## Inputs To Ask For

- Screen or component scope (e.g., dashboard, chart detail, profile, modal sheet).
- Data shape for charts and cards.
- Interaction needs (haptics, gestures, navigation routes).
- Target platform differences (iOS/Android) if needed.

## Workflow

1. Review visual references in `packages/docs/reference_assets`. Prefer The Outsiders screenshots and map their layout, spacing, typography, and component structure.
2. Identify the screen structure and key components: header, hero metric, cards, charts, nav, sheets.
3. Define tokens locally in the target file (or a nearby `styles` module) for colors, spacing, radius, blur, and shadows.
4. Implement the screen in TS/TSX using the existing Expo stack.
5. Add interactions: bottom sheets via `@gorhom/bottom-sheet`, navigation via React Navigation, haptics via `expo-haptics`.
6. Ensure Android parity: soften shadows, increase contrast, and avoid text clipping.

## Design DNA (Outsiders + iOS/One UI)

- Dark, immersive surfaces with saturated accent gradients and neon glow.
- High-contrast hero metric (large numerals) paired with short explanatory copy.
- Rounded cards with soft elevation and a subtle glassy feel.
- Strong vertical rhythm: large top padding, tight card spacing, and bottom nav visibility.
- Charts are minimalist, high-contrast, and overlaid on low-contrast grids.

## Implementation Guidelines

- Prefer `expo-linear-gradient` for hero backgrounds and glow accents.
- Use `expo-blur` sparingly for frosted surfaces and bottom nav backplates.
- For charts, use `victory-native` and `react-native-svg`. Keep axes minimal.
- For sheets, use `@gorhom/bottom-sheet` with rounded top corners and blur.
- For nav, use `@react-navigation/*` with a custom tab bar to match the rounded, pill-style bar from the references.

## Reference Assets

Use `references/outsiders.md` for the exact filenames and notes on what to extract from each reference image.
