# Stage Execution Template

Copy this block at the start of every staged task.

---

## Pre-Flight

**context.md read:** [ ]  
**Task docs read:** [ ] (list them)  
**Stages needed:** P0, P1, [ ] P2, [ ] P3, [ ] P4, [ ] P5

**Files to be touched:**

| File               | Stage | Action |
| ------------------ | ----- | ------ |
| `path/to/file.ts`  | P0    | create |
| `path/to/other.ts` | P1    | modify |

**Validation commands (from context.md):**

- typecheck: `___`
- lint: `___`
- test: `___`

**Ambiguities (resolve before proceeding):**

- [ ] none / [ ] [list here]

---

## P0 — Foundations

Scope: types, schemas, interfaces, contracts, file scaffolding, constants.

**Completing:**

- [ ] All type definitions created
- [ ] All validation schemas created
- [ ] All module exports and barrel files set up
- [ ] No business logic present in any new file

**Exit checks:**

- [ ] typecheck: PASS
- [ ] lint: PASS

**context.md update:** required / not required  
**Reason if not required:** \_\_\_

---

## P1 — Core Logic + Backend

Scope: algorithms, services, route handlers, DB queries, data transforms.

**Completing:**

- [ ] All service methods implemented
- [ ] All route handlers implemented
- [ ] Happy-path test exists for each new service method
- [ ] No P0 types were changed (or if changed, P0 exit checks re-run)

**Exit checks:**

- [ ] typecheck: PASS
- [ ] lint: PASS
- [ ] relevant tests: PASS

**context.md update:** required / not required  
**Reason if not required:** \_\_\_

---

## P2 — UI Integration

Scope: components, loading/error/empty states, interactions, animations.

**Completing:**

- [ ] All components render in loading state
- [ ] All components render in error state
- [ ] All components render in empty/zero-data state
- [ ] All components render in happy-path state
- [ ] No new API endpoints added (those belong in P1)

**Exit checks:**

- [ ] typecheck: PASS
- [ ] lint: PASS
- [ ] UI/component tests: PASS (or "not present in this repo")
- [ ] Smoke test: PASS (see smoke-test-protocol.md)

**context.md update:** required / not required  
**Reason if not required:** \_\_\_

---

## P3 — Testing + Audit + Summary

**Full suite checks:**

- [ ] Full monorepo typecheck: PASS
- [ ] Full lint: PASS
- [ ] Full test suite: PASS

**Implementation summary:**

> (2–4 sentences: what was built, key decisions made, why)

**Invariant checklist:**

| Acceptance criterion  | Status      |
| --------------------- | ----------- |
| [criterion from task] | PASS / FAIL |

**Residual risks:**

- [ ] none / [ ] [list deferred items and known gaps]

**Out-of-scope observations logged:**

- [ ] none / [ ] [list everything noticed but not implemented]

**context.md final diff:**

- [ ] Updated (list changed lines/sections)
- [ ] Not required — [reason]

---

## P4 — Hardening (if used)

Scope: retries, backoff, idempotency, rate limiting, race conditions.

- [ ] Each hardened path has a targeted test
- [ ] P1/P2 regression tests still pass

---

## P5 — Rollout / Observability (if used)

Scope: feature flags, structured logging, migration coordination, final docs.

- [ ] Release-level checks pass
- [ ] Final documentation diff reviewed
