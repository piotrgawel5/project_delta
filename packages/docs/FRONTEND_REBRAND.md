# 🎨 UI Rebranding Brief: Project Delta -> "GO Club/Outsiders" Style

## 1. Objective

Refactor the **Project Delta** mobile application (React Native / Expo) to match the visual identity found in the provided reference screenshots ("GO Club", "The Outsiders").

**Reference Assets:**

- `GO Club iOS *.jpg`
- `The Outsiders iOS *.jpg`

---

## 2. Current Architecture Snapshot

The agent must be aware of the current styling stack to efficiently refactor:

- **Framework:** React Native (Expo SDK 50+) with Expo Router.
- **Styling Engine:** `nativewind` (Tailwind CSS) + `global.css`.
- **Animation:** `react-native-reanimated` (Shared Values for colors/layout).
- **Graphics:** `react-native-svg` (Heavily used for charts/rings).
- **Current Theme:** \* **Background:** `#000000` (Pure Black)
  - **Primary Accent:** `#30D158` (Apple Fitness Green)
  - **Secondary:** `#3E42A9` (Indigo/Blue)
  - **Fonts:** Inter (Body) & Poppins (Headings)

---

## 3. Style Extraction Tasks (For Agent)

_Analyze the provided screenshots and update the following definitions:_

### A. Color Palette

Identify and replace the current palette in `apps/mobile/global.css` and `packages/shared/src/constants/theme.ts`.

- **Backgrounds:** Is it pure black (`#000`), dark grey (`#1C1C1E`), or a gradient?
- **Primary Brand:** Extract the dominant main action color.
- **Secondary/Tertiary:** Extract colors used for secondary buttons or data visualization.
- **Text Colors:** Identify specific shades for Headings vs Body text (e.g., is it pure white `#FFF` or off-white `#F2F2F7`?).

### B. Typography & Shapes

- **Font Family:** Does the style use a serif (elegant), sans-serif (modern), or mono (technical)?
  - _Current:_ Inter/Poppins.
  - _Target:_ Check screenshots for font weights (Bold vs Light).
- **Border Radius:** Are cards fully rounded (pill-shaped), moderately rounded (16px-24px), or sharp?
- **Glassmorphism:** Check screenshots for blur effects (`BlurView`) vs solid opaque backgrounds.

---

## 4. Implementation Checklist

### Phase 1: Global Theme Update

Target these files to switch the core visual foundation.

- [ ] **Tailwind Config** (`apps/mobile/global.css`)
  - Update the `@theme` block or `root` variables to match the new color palette.
  - Define new utility classes for common background gradients if present in screenshots.

- [ ] **Shared Constants** (`packages/shared/src/constants/theme.ts`)
  - Update `Theme.colors` object to ensure TypeScript types match the new palette.

- [ ] **Font Configuration** (`apps/mobile/app/_layout.tsx`)
  - If the "Outsiders" style requires a new font (e.g., a condensed font or serif), load it here using `useFonts`.

### Phase 2: Component Refactoring

Update these specific components to match the new "Look & Feel".

- [ ] **Gradients & Orbs** (`apps/mobile/components/onboarding/OnboardingScreen.tsx`)
  - The current app uses heavy "Orb" background gradients (`styles.orb`).
  - **Task:** Adjust `colors` array in `<LinearGradient>` to match the screenshots. If the new style is cleaner/flat, remove the orbs.

- [ ] **Tab Bar** (`apps/mobile/components/navigation/TabBar.tsx`)
  - **Task:** Match the active/inactive state and background blur intensity to the screenshots.

- [ ] **Action Buttons** (`apps/mobile/components/ui/*`)
  - Update button heights, border radius, and shadow properties to match the "GO Club" buttons.

### Phase 3: Data Visualization (Charts & Rings)

The app relies heavily on SVG rings.

- [ ] **Sleep/Activity Rings** (`apps/mobile/app/(tabs)/sleep.tsx` & `workout.tsx`)
  - **Task:** Update `SvgLinearGradient` stops.
  - _Current:_ Uses `#30D158` (Green) and `#3E42A9` (Blue).
  - _Target:_ Extract chart colors from the "iOS 12/9/7" screenshots.

---

## 5. Specific File Targets for Agent

| Area             | File Path                                                | Action                                   |
| :--------------- | :------------------------------------------------------- | :--------------------------------------- |
| **Colors (CSS)** | `apps/mobile/global.css`                                 | Update CSS variables/Tailwind theme.     |
| **Colors (TS)**  | `packages/shared/src/constants/theme.ts`                 | Update hex codes.                        |
| **Tab Nav**      | `apps/mobile/app/(tabs)/_layout.tsx`                     | Update accent colors & icon styles.      |
| **Sleep UI**     | `apps/mobile/app/(tabs)/sleep.tsx`                       | Refactor SVG Gradients & "Bedtime" dial. |
| **Onboarding**   | `apps/mobile/components/onboarding/OnboardingScreen.tsx` | Update background layout/gradients.      |
| **Profile**      | `apps/mobile/app/(tabs)/account.tsx`                     | Update avatar and list item styling.     |
