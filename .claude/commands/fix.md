# /fix $ARGUMENTS

Fix the following issue in Project Delta:

**$ARGUMENTS**

## Approach

1. Read the file(s) involved — do not guess at the bug
2. Identify the root cause (not just the symptom)
3. Fix only what was asked — no opportunistic refactors
4. Verify the fix with targeted tests or typecheck

## Diagnosis Steps

```bash
# Get failing test output
npx jest apps/mobile/lib/__tests__/<file>.test.ts --verbose

# Type errors
npx tsc --noEmit -p apps/mobile/tsconfig.json
npx tsc --noEmit -p services/api/tsconfig.json

# Lint errors
cd apps/mobile && npm run lint
```

## Constraints

- Fix the stated issue. Do not rewrite surrounding code.
- No `@ts-ignore`, `@ts-expect-error`, or `eslint-disable` unless unavoidable and commented.
- Do not weaken types to suppress errors (no `any`, no making required fields optional).
- If the fix touches sleep UI: verify no hardcoded hex, no waterfall fetches introduced.

## After the Fix

- Run relevant tests
- Confirm typecheck passes
- One-sentence explanation of what the root cause was and how it was resolved
