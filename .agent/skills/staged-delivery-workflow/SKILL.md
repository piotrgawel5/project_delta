---
name: staged-delivery-workflow
description: Execute complex, multi-file implementation tasks in strict P-stages (P0–P5). Enforces phased scope, mandatory validation after every stage, and context.md as the single source of truth. Use for any task that spans more than two files or involves backend + UI layers.
---

# Staged Delivery Workflow

## Pre-Flight (Required Before ANY Code)

Before writing a single line of code:

1. Read `packages/docs/context.md` in full — no exceptions.
2. Read every task-specific implementation doc linked in the prompt.
3. Declare your understanding:
   - Which stages are needed (P0–P5)?
   - Which files will be touched, and in which stage?
   - What are the validation commands for this repo?
4. State any ambiguities you cannot resolve from the docs.
   **If an ambiguity would cause you to guess at an architectural decision, stop and surface it before proceeding.**

---

## Stage Model

### P0 — Foundations

**Goal:** Establish the skeleton. Zero business logic.

**Allowed:**

- Type definitions and interfaces
- Zod/validation schemas
- API contracts and route stubs (no handler body)
- Module exports and barrel files
- File scaffolding (empty files with correct imports/exports)
- Constants and configuration

**Not allowed:**

- Any algorithm or computed value
- Any rendering logic
- Any DB query

**Exit criteria:**

- `typecheck` passes with zero errors
- `lint` passes on all touched files
- Every new file has its final intended import path (no renames later)

---

### P1 — Core Logic + Backend

**Goal:** Implement pure logic, services, queries, and route handlers. No UI.

**Allowed:**

- Algorithm implementation (pure functions)
- Service methods and repository queries
- Route handler bodies
- Data transformation and mapping

**Not allowed:**

- UI components or rendering
- Changes to types defined in P0 unless a genuine invariant was wrong
  (if you must change a P0 type, re-run P0 exit criteria before continuing P1)

**Exit criteria:**

- `typecheck` passes
- `lint` passes
- All relevant backend/service unit tests pass
- Any new service method has at least one test covering the happy path

---

### P2 — UI Integration

**Goal:** Wire components, handle loading/error/empty states, implement interactions.

**Allowed:**

- Component composition and rendering
- Loading, error, and empty state handling
- User interaction hooks
- Minor business logic only if it is exclusively a UI concern
  (e.g., tooltip position math, animation timing)

**Not allowed:**

- Changing service methods or DB queries defined in P1
- Adding new API endpoints (those belong in P1)

**Exit criteria:**

- `typecheck` passes
- `lint` passes
- All UI/component tests pass (if the repo has them)
- Manual smoke-test checklist completed (see references/smoke-test-protocol.md)

---

### P3 — Testing + Audit + Summary

**Goal:** Harden quality gates, verify invariants, document what changed.

**Required checks:**

- Full `typecheck` across entire monorepo
- Full `lint` across all touched packages
- Full test suite for all touched packages

**Required deliverables:**

1. **Implementation summary** — what was built and why each major decision was made
2. **Invariant checklist** — explicit pass/fail for every acceptance criterion in the task
3. **Residual risks** — known edge cases not covered, tech debt incurred, or follow-up tasks required
4. **context.md diff** — list every line changed in context.md, or state "context.md update not required" with reason

---

### P4 — Hardening (Optional)

Use when the task involves any of:

- Retry logic or backoff
- Idempotency guards
- Rate limiting
- Race condition mitigations
- Performance-critical paths

**Exit criteria:**

- Targeted tests for every hardened path
- Regression tests for P1/P2 behavior still pass

---

### P5 — Rollout / Observability (Optional)

Use for production-critical changes that require:

- Feature flags or gradual rollout
- Structured logging or telemetry
- Database migration coordination
- Final documentation sync

**Exit criteria:**

- Release-level checks required by the repo
- Final documentation diff reviewed and approved

---

## Failure Protocol

When a required check fails, the response is always:

1. **Stop advancing.** Do not start the next stage.
2. **Diagnose** the failure in one sentence.
3. **Fix** the root cause. Do not suppress errors, widen types to `any`, or disable lint rules to make checks pass — these are invariant violations.
4. **Re-run** the failing check. Confirm it now passes.
5. **State clearly:** "Check now passes. Advancing to [next stage]."

**Forbidden workarounds:**

- `@ts-ignore` or `@ts-expect-error` without a specific documented reason
- `eslint-disable` without a specific documented reason
- Weakening an interface (e.g., making a required field optional) to suppress a type error
- Deleting a test that fails instead of fixing the code

---

## Scope Guard

Tasks expand. Guard against it.

**In-scope** means: explicitly mentioned in the task prompt or required to make an explicitly mentioned thing work.

**Out-of-scope** means: improvements, refactors, or additions you noticed while working that were not mentioned.

When you notice something out-of-scope:

1. Do not implement it.
2. Log it: "Out-of-scope observation: [description]. Deferring."
3. List all deferred items in the P3 residual risks section.

If you believe an out-of-scope change is a **blocker** (i.e., the task literally cannot be completed without it):

1. Stop.
2. State: "Blocker found: [description]. This is out of scope but required. Proceeding will require expanding scope — confirm?"
3. Wait for confirmation before proceeding.

---

## context.md Update Rules

Update `packages/docs/context.md` when any of the following change:

| Changed thing                                   | Update required |
| ----------------------------------------------- | --------------- |
| New npm script or changed command               | Yes             |
| New path alias or import convention             | Yes             |
| New module with its own responsibility boundary | Yes             |
| New API integration pattern                     | Yes             |
| New architectural constraint                    | Yes             |
| New required validation step                    | Yes             |
| File renamed or moved                           | Yes             |
| Bug fix or feature with no structural change    | No              |
| UI component added without new conventions      | No              |

If no update required, state: `context.md update not required — no structural or convention changes.`

---

## Anti-Patterns

These are common Codex failure modes. Do not do them.

**Skipping pre-flight.** Starting to code before reading context.md produces import errors, wrong command names, and convention violations that cost more time to fix than the pre-flight took.

**Combining stages.** "I'll just add the service method while I'm doing the types." This is how scope explodes and why checks fail unexpectedly mid-stage.

**Fixing type errors by widening types.** `any`, `unknown` casts, and optional chaining on fields that should be required are not fixes — they are deferred bugs.

**Advancing past a failing check.** If `typecheck` fails at P0 exit, P1 has already started on a broken foundation.

**Silent scope expansion.** Adding a feature you noticed while working, without declaring it, is scope creep. The P3 summary will be inaccurate and the task will take longer than expected.

**Updating context.md last (or never).** context.md must be updated as part of the stage where the structural change happens, not as an afterthought in P3.

**Re-reading context.md mid-task.** If you need to re-read it, something in pre-flight was missed. This is allowed but signals that pre-flight was incomplete.

---

## Execution Checklist (Copy for Each Task)

```
[ ] Read packages/docs/context.md in full
[ ] Read all task-specific docs
[ ] Declared stages needed
[ ] Declared files to be touched per stage
[ ] Declared validation commands

P0 [ ] Types / schemas / contracts / scaffolding complete
P0 [ ] typecheck passes
P0 [ ] lint passes

P1 [ ] Logic / services / routes complete
P1 [ ] typecheck passes
P1 [ ] lint passes
P1 [ ] relevant tests pass

P2 [ ] UI components / interactions complete
P2 [ ] typecheck passes
P2 [ ] lint passes
P2 [ ] UI tests pass (if present)
P2 [ ] smoke-test checklist complete

P3 [ ] Full monorepo typecheck passes
P3 [ ] Full lint passes
P3 [ ] Full test suite passes
P3 [ ] Implementation summary written
P3 [ ] Invariant checklist written
P3 [ ] Residual risks listed
P3 [ ] context.md updated or "not required" declared
```
