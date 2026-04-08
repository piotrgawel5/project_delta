# /test $ARGUMENTS

Write tests for the following in Project Delta:

**$ARGUMENTS**

## Test Location & Naming

- All unit tests: `apps/mobile/lib/__tests__/<name>.test.ts`
- Naming convention: matches the source file (e.g., `sleepAnalysis.ts` → `sleepAnalysis.test.ts`)
- Run from repo root: `npx jest apps/mobile/lib/__tests__/<name>.test.ts`

## Test Principles

- **Deterministic:** No `Date.now()`, no randomness, no real API calls — mock at boundary
- **Logic-focused:** Test pure functions and algorithms, not UI rendering
- **Edge cases first:** 0-duration sleep, missing stages, boundary values, data source fallbacks
- **No UI snapshots**

## Structure

```ts
import { functionUnderTest } from '@lib/sleepAnalysis';

describe('functionUnderTest', () => {
  it('handles nominal case', () => {
    const result = functionUnderTest({ duration: 480, deepPct: 0.2 });
    expect(result.score).toBeCloseTo(72, 0);
  });

  it('clamps at 0 for zero duration', () => {
    const result = functionUnderTest({ duration: 0, deepPct: 0 });
    expect(result.score).toBe(0);
  });

  it('handles missing optional fields gracefully', () => {
    const result = functionUnderTest({ duration: 480 }); // no deepPct
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
```

## Sleep Score Invariants to Test

- Score is always in [0, 100]
- `duration: 0` → `score: 0`
- `efficiency: 1.0, duration: 480, deepPct: 0.2, remPct: 0.22` → score ≥ 80
- Data source `manual` has `stageDataValid: false` → stage fields should not be trusted

## Run Tests

```bash
npx jest apps/mobile/lib/__tests__/$ARGUMENTS.test.ts --verbose
```
