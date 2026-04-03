# Sleep Bottom Sheet — UI & Interaction Updates

## General Rule

- **Do not create commits.**
- Make all changes in the working tree only.
- Leave version control actions to me.

---

## 1. Theme Changes

**File:** `@apps/mobile/constants/theme.ts`

- Set the default background color for all **standard bottom sheets** to:

```ts
#000000
```

- This is intentional to optimize appearance on OLED displays.
- This should become the shared default used across bottom sheet components.

---

## 2. Button Styling

Update the buttons inside the sleep bottom sheet:

- Change **“Next”** and **“Save Sleep”** buttons:
  - Replace the current blue styling.
  - Use **white** or a neutral white derivative instead.

- The goal is visual consistency with the component’s dark theme.

---

## 3. Time Selector Format

Modify the time selector:

- Remove the `*5 minutes` label entirely.
- Restrict selectable minute values to **10-minute increments only**:

```
00, 10, 20, 30, 40, 50
```

---

## 4. Bottom Sheet Close Gesture

Add gesture-based closing behavior:

- The **top pill/handle** area should support drag interaction.
- User should be able to:
  - Drag downward smoothly.
  - See the sheet follow the finger with animation.
  - Close the sheet when a defined gesture threshold is exceeded.

Requirements:

- Smooth animation.
- Natural motion interpolation.
- No abrupt snapping unless threshold is crossed.

---

## 5. Time Picker — Adjacent Value Tap Selection

Enhance interaction for the time picker wheel.

### Desired Behavior

Example:

- If `11:00` is currently selected,
- Adjacent visible values (e.g., `10:55`, `11:05`) should be tappable.

### Interaction Rules

- Adjacent values must be selectable via **pure tap**.
- Selection occurs only when:
  - Finger touches and releases without meaningful movement.

- If **vertical movement** is detected:
  - Interaction immediately becomes a scroll gesture.
  - Tap selection must be cancelled.

### Goal

Provide fast single-tap selection while preserving smooth scrolling behavior.

---

## 6. Scope Constraint

- Preserve all existing behavior unless modification is required for the changes above.

---

## 7. After Implementation

Provide a summary including:

- Files modified
- Key implementation decisions
- Tradeoffs or edge cases encountered
