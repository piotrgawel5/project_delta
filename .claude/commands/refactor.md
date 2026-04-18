# /refactor $ARGUMENTS

Refactor the following in Project Delta:

**$ARGUMENTS**

## Rules

1. Read every file you will touch before proposing changes
2. Preserve all existing behavior — refactor only, no feature additions
3. Minimal diff — change only what is required for the stated goal
4. No opportunistic cleanup of adjacent code that wasn't mentioned

## Common Refactor Patterns

### Extract shared logic
Move to `packages/shared/src/` (no React imports) or `apps/mobile/lib/` (pure functions).

### Consolidate Zustand selectors
Replace inline selectors with stable references:
```ts
// Before (re-renders on any store change)
const store = useSleepStore();
// After (granular)
const score = useSleepStore(s => s.data?.score);
```

### Break waterfall fetches
Replace sequential `useEffect` chains with `Promise.all` in Zustand store action.

### Fix corner radii
```ts
// Before (optical mismatch)
<OuterCard borderRadius={16}><InnerCard borderRadius={16} /></OuterCard>
// After (correct: outer = inner + padding)
const inner = SLEEP_LAYOUT.cardRadiusInner;   // 16
const outer = SLEEP_LAYOUT.cardRadiusOuter;   // 20 (= inner + 4px padding diff)
```

## Validation

```bash
npx tsc --noEmit -p apps/mobile/tsconfig.json
cd apps/mobile && npm run lint
npx jest apps/mobile/lib/__tests__
```

Confirm all tests pass before and after. If behavior changes, the refactor is wrong.
