# Failure Decision Tree

Use this reference when a stage exit check fails.

---

## When `typecheck` fails

```
Is the error in a file YOU created or modified this stage?
├── YES → Fix the root cause. Do not cast to `any`. Do not use @ts-ignore.
│         Re-run typecheck. Confirm PASS before continuing.
└── NO  → Is it in a file that your changes depend on?
          ├── YES → Your P0 types may be wrong. Review the interface.
          │         Fix the type definition, not the consumer.
          └── NO  → Pre-existing error unrelated to this task.
                    Log: "Pre-existing typecheck error in [file] — not introduced by this task."
                    Do not fix it (out of scope). Do not let it block your stage.
                    If your repo's CI would have caught it anyway, note it in P3 residual risks.
```

**Forbidden typecheck workarounds:**

- `as any` — masks real type mismatches
- `@ts-ignore` — silences errors without understanding them
- Making a required field optional — defers a runtime crash
- Adding `| undefined` to a return type that should never be undefined

---

## When `lint` fails

```
Is the lint rule relevant to code you wrote?
├── YES → Fix the code to satisfy the rule.
│         If the rule is genuinely inapplicable (e.g., a false positive on
│         generated code), add an inline eslint-disable with a specific reason:
│           // eslint-disable-next-line rule-name -- [reason]
│         Never use blanket eslint-disable for a whole file.
└── NO  → Pre-existing lint error. Log and continue (same as typecheck above).
```

---

## When a test fails

```
Is the failure in a test YOU wrote?
├── YES → Is the test wrong, or is the code wrong?
│         ├── Code is wrong → fix the code, not the test.
│         └── Test expectation was wrong → fix the test assertion, document why.
└── NO  → Is it a pre-existing failure?
          ├── YES → Log it. Do not fix it (out of scope). Note in P3.
          └── NO  → Your changes broke an existing test.
                    This is a regression. Fix the root cause before advancing.
                    Do not delete the test.
```

---

## When a stage is stuck

If you have attempted to fix a check failure twice and it is still failing:

1. Stop.
2. Write a full diagnosis: what the error says, what you changed, what you tried.
3. Surface it explicitly: "Blocked at [stage] exit check: [description]. Need guidance."

Do not continue to the next stage while a required check is failing.

---

## Check Priority Order

When multiple checks fail simultaneously, fix them in this order:

1. **Typecheck** — type errors propagate and create false lint/test failures
2. **Lint** — lint errors can hide logic issues
3. **Tests** — fix tests last since they depend on correct types and linted code

Never try to fix all three simultaneously. Fix typecheck → re-run all → fix remaining lint → re-run → fix tests.
