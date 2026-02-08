# Fix Gradient Flicker During Sleep Data Transitions

## Problem Analysis

I've analyzed the screen recording frame-by-frame. The issue is a **single-frame bright green/cyan flash** that occurs during transitions between dates in the sleep tracking UI. Specifically:

- **Frame 0071**: Purple gradient (correct)
- **Frame 0072**: Bright green/cyan gradient (FLICKER - wrong color)
- **Frame 0073**: Purple gradient (correct)

The mean pixel intensity jumps from ~7572 to 9411 and back to ~7585, confirming a full-frame color flash lasting exactly 1 frame (~11ms at 90fps).

## Current State

File: `apps/mobile/lib/useSleepGradient.ts`

**Implemented optimizations:**
1. Animation lock + pending target queue system
2. `withTiming` callback calls `runOnJS(handleAnimationEnd)(animationId)`
3. `handleAnimationEnd` (JS thread) checks animation ID, clears lock, applies pending target using `animateToRef`
4. `setImmediate` cancels animation and clears state
5. Linear gradient optimization yielded ~115 FPS but introduced this flicker

**Current behavior:**
- Without gradient: ~118-120 FPS ✓
- With current gradient implementation: ~115 FPS but **1-frame bright green flash during transitions**

## Root Cause Hypothesis

The flicker is caused by a **race condition in the gradient color update pipeline**:

1. When transitioning between dates, new gradient colors are computed on the JS thread
2. The colors are passed to the UI thread via shared values
3. For exactly 1 frame, either:
   - Default/fallback gradient colors (green) are rendered
   - Old colors are cleared before new colors are set
   - The gradient updates before the animation starts, then jumps to an intermediate state

## Required Fix

**Primary objective:** Eliminate the single-frame green flash while maintaining ~115 FPS performance.

### Investigation Steps

1. **Check gradient initialization in `useSleepGradient.ts`:**
   ```typescript
   // Look for default color definitions - is green/cyan the default?
   // Example: const defaultColors = ['#00ff00', '#00ffff']
   ```

2. **Verify shared value updates:**
   ```typescript
   // Ensure gradient colors update atomically
   // Check if there's a timing gap between:
   //   - Setting colors on shared values
   //   - Starting the animation
   ```

3. **Review the animation callback chain:**
   ```typescript
   // Current flow: withTiming → runOnJS(handleAnimationEnd) → animateToRef
   // Check if colors update between these steps
   ```

### Proposed Solutions (Implement in Priority Order)

#### Solution 1: Synchronous Color Update (Preferred)
Ensure gradient colors are set **atomically** with animation start on the UI thread:

```typescript
// In useSleepGradient.ts
const updateGradient = (targetColors: string[]) => {
  'worklet';
  
  // Option A: Set colors and start animation in same worklet execution
  gradientColors.value = targetColors;
  gradientOpacity.value = withTiming(1, { duration: 300 }, (finished) => {
    if (finished) {
      runOnJS(handleAnimationEnd)(animationId);
    }
  });
};
```

#### Solution 2: Double-Buffer Pattern
Use two gradient layers and cross-fade between them:

```typescript
const [gradientA, gradientB] = useState({
  colors: initialColors,
  opacity: useSharedValue(1)
});

// When updating:
// 1. Set new colors on hidden gradient (opacity: 0)
// 2. Fade out current, fade in new
// 3. This prevents the default color flash
```

#### Solution 3: Skip Transitions for Small Deltas
If the color change is minimal, don't animate:

```typescript
const colorDelta = calculateColorDifference(currentColors, targetColors);
if (colorDelta < THRESHOLD) {
  gradientColors.value = targetColors; // Instant update
  return;
}
// Otherwise, animate as normal
```

#### Solution 4: Add Pre-Load Delay
Ensure new colors are fully set before starting transition:

```typescript
const updateGradient = (targetColors: string[]) => {
  gradientColors.value = targetColors;
  
  // Wait for next frame before starting animation
  requestAnimationFrame(() => {
    'worklet';
    gradientOpacity.value = withTiming(1, ...);
  });
};
```

### Testing Requirements

After implementing fix:

1. **Flicker test:** Record 10+ date transitions at 120fps, extract frames, verify NO frames show green/cyan
2. **Performance test:** Ensure FPS remains ≥115 (use the FPS counter visible in the recording)
3. **Smooth transitions:** Verify gradients still smoothly transition between sleep quality colors
4. **Edge cases:**
   - Rapid swiping between multiple dates
   - Transition during active animation
   - App backgrounding/foregrounding during transition

### Debug Output

Add temporary logging to identify the exact failure point:

```typescript
const updateGradient = (targetColors: string[]) => {
  console.log('[Gradient] Update requested:', targetColors);
  console.log('[Gradient] Current colors:', gradientColors.value);
  console.log('[Gradient] Lock status:', isAnimating.current);
  
  // ... rest of implementation
};
```

### Success Criteria

✅ Zero green/cyan flashes during transitions (verify with frame-by-frame analysis)  
✅ FPS remains ≥115 with gradient enabled  
✅ Smooth color transitions between dates  
✅ No "[Worklets] Tried to modify key current" warnings  
✅ Animation queue works correctly for rapid swipes

## Technical Context

- **Framework:** React Native with Reanimated 3
- **Gradient:** Using `LinearGradient` (likely from expo-linear-gradient or react-native-linear-gradient)
- **Animation:** `withTiming` for smooth transitions
- **Threading:** Worklets for UI thread operations, `runOnJS` for JS thread callbacks
- **Current file:** `apps/mobile/lib/useSleepGradient.ts`

## Additional Notes

The green/cyan color appearing suggests it might be:
1. A hardcoded default/fallback gradient in the component using `useSleepGradient`
2. An RGB interpolation artifact (e.g., `rgba(0,255,255,1)` or `#00ffff`)
3. A color from the staging/development environment

**Search the codebase for:**
```bash
grep -r "#00ff" apps/mobile/
grep -r "rgba(0, 255" apps/mobile/
grep -r "defaultGradient\|fallbackGradient" apps/mobile/
```

This will help identify where the green flash is coming from.
