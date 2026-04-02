---
name: staged-delivery-workflow
description: >
  Execute complex, multi-file implementation tasks in strict P-stages (P0–P5).
  Enforces phased scope, mandatory validation after every stage, and context.md
  as the single source of truth. Use for any task spanning >2 files or backend + UI layers.
allowed-tools: Read,Write,Bash(npm run test),Bash(npm run lint),Bash(npm run typecheck),Bash(git diff)
---

# Staged Delivery Workflow — Claude Code Edition

## Pre-Flight (Required Before Code)

Before writing **any line of code**:

### 1. Read & Declare Understanding

```
[ ] Read packages/docs/context.md in full
[ ] Read all task-specific implementation docs
[ ] Declare which stages are needed (P0–P5)
[ ] Declare which files will be touched per stage
[ ] Declare validation commands for this repo
```

**Output declaration:**
```
Stages needed: P0, P1, P2, P3
Files by stage:
  P0: types/sleep.ts, schemas/sleep.zod.ts
  P1: services/sleep.service.ts, routes/sleep.api.ts
  P2: components/SleepCard.tsx, screens/SleepScreen.tsx
  P3: integration tests, docs update
Validation: npm run typecheck && npm run lint && npm run test
```

### 2. Surface Ambiguities

If an ambiguity would cause guessing at an architectural decision:

```
❌ BLOCKED: Task says "fetch sleep data" but context.md lists three different
patterns (batch-fetch, lazy-fetch, stream). Which pattern applies here?
Awaiting clarification before proceeding.
```

---

## Stage Model

### P0 — Foundations (Zero Business Logic)

**Goal:** Establish skeleton. Type definitions, schemas, contracts, stubs.

**Allowed:**
- Type definitions and interfaces
- Zod/validation schemas
- API contracts and route stubs (handler body = `throw new Error('not implemented')`)
- Module exports, barrel files
- File scaffolding (empty files with correct imports)
- Constants and configuration

**Not allowed:**
- Algorithm or computed value
- Rendering logic
- DB queries

**Implementation approach:**

```ts
// Example P0: type definitions + Zod schema
export interface SleepData {
  userId: string;
  date: string;
  score: number;
}

export const SleepDataSchema = z.object({
  userId: z.string().uuid(),
  date: z.string().date(),
  score: z.number().min(0).max(100),
});

// API contract (no handler body yet)
router.post('/sleep', (req, res) => {
  throw new Error('P1: implement handler');
});
```

**Exit Criteria:**
```
[ ] All new files exist with correct import paths
[ ] typecheck passes — zero errors
[ ] lint passes on all touched files
[ ] No file names will be changed later (naming is final)
```

**Before advancing:** Run and confirm:
```bash
npm run typecheck
npm run lint -- apps/mobile/  # or relevant package
```

---

### P1 — Core Logic + Backend (No UI)

**Goal:** Algorithm, service methods, route handlers, queries. Pure logic layer.

**Allowed:**
- Algorithm implementation (pure functions)
- Service methods and repository queries
- Route handler bodies and business logic
- Data transformation and mapping
- Database migrations (if needed)

**Not allowed:**
- UI components or rendering
- Changes to P0 types (if needed, re-run P0 exit before continuing)
- Adding new types (should have been in P0)

**Implementation approach:**

```ts
// Example P1: service implementation
export class SleepService {
  async getAllSleep(userId: string, date: string): Promise<SleepData> {
    // Pure logic, no React/rendering
    const [raw, timeline] = await Promise.all([
      this.db.getSleepRaw(userId, date),
      this.db.getTimeline(userId, date),
    ]);
    return this.computeScore(raw, timeline);
  }

  private computeScore(raw: Raw, timeline: Timeline): number {
    // Algorithm (pure function)
    return Math.round(raw.duration / 8 * 100 + timeline.interruptions * -5);
  }
}

// Route handler (P1, not P2)
router.post('/sleep', async (req, res) => {
  const service = new SleepService();
  const data = await service.getAllSleep(req.user.id, req.body.date);
  res.json(data);
});
```

**Exit Criteria:**
```
[ ] typecheck passes — zero errors
[ ] lint passes on all touched files
[ ] All service unit tests pass (happy path minimum)
[ ] No rendering or React hooks introduced
[ ] If DB queries added, migration script is reversible
```

**Before advancing:** Run and confirm:
```bash
npm run typecheck
npm run lint -- services/
npm run test -- sleep.service.test.ts
```

**Common P1 mistakes:**
- Adding UI state (Zustand) — defer to P2
- Styling components — defer to P2
- Route handler receives request but doesn't implement logic — fail, go back and fix

---

### P2 — UI Integration (Components + Interactions)

**Goal:** Wire components, handle loading/error/empty states, implement gestures.

**Allowed:**
- Component composition and rendering
- Loading, error, empty state handling
- User interaction hooks
- Minor UI-only logic (e.g., animation timing, tooltip positioning)
- Zustand store integration

**Not allowed:**
- Changing P1 service methods
- Adding new API endpoints (those go in P1)
- Database queries (those go in P1)

**Implementation approach:**

```ts
// Example P2: component integration
const SleepScreen = () => {
  const score = useSleepStore((s) => s.data?.score);
  const isLoaded = useSleepStore((s) => s.isLoaded);
  const error = useSleepStore((s) => s.error);

  useEffect(() => {
    useSleepStore.getState().fetchAll(userId, date);  // P1 service call
  }, [userId, date]);

  if (!isLoaded) return <LoadingPlaceholder />;
  if (error) return <ErrorState error={error} />;
  if (!score) return <EmptyState />;

  return (
    <View>
      <SleepCard score={score} />
    </View>
  );
};
```

**Exit Criteria:**
```
[ ] typecheck passes — zero errors
[ ] lint passes on all touched files
[ ] All UI tests pass (if repo has them)
[ ] Manual smoke-test complete (see smoke-test-protocol.md)
[ ] Loading, error, empty states verified
```

**Before advancing:** Run and confirm:
```bash
npm run typecheck
npm run lint -- components/
npm run test -- SleepScreen.test.tsx  # if present
```

**Common P2 mistakes:**
- Fetching data directly in component instead of using P1 service
- Not handling loading/error states
- Changing P1 logic to fit UI needs (instead of adapting UI to P1)

---

### P3 — Testing + Audit + Summary (Hardening Quality)

**Goal:** Full validation, invariant verification, documentation.

**Required Checks:**

```bash
# Full monorepo validation
npm run typecheck  # entire repo
npm run lint       # entire repo
npm run test       # entire test suite
```

**Required Deliverables:**

1. **Implementation Summary** (4–6 sentences)
   ```
   What was built and why each major decision was made.
   
   Example:
   "Implemented batch-fetch pattern via Zustand store to eliminate
   waterfall requests on SleepScreen mount. Service layer handles
   all date transformations; UI layer only handles loading/error states.
   Decision to use Promise.all instead of sequential fetches saves
   ~800ms on first load."
   ```

2. **Invariant Checklist** (explicit pass/fail for each acceptance criterion)
   ```
   [ ] PASS: Sleep score calculation matches spec (O = D/8 * 100 - I*5)
   [ ] PASS: No waterfall fetches introduced (uses Promise.all)
   [ ] PASS: UI handles error state with retry button
   [ ] FAIL: Empty state not implemented — added to P4 residual risks
   ```

3. **Residual Risks** (known gaps, edge cases, tech debt)
   ```
   - Empty state UI not yet designed (Figma pending)
   - No retry logic on fetch failure (use exponential backoff in P4)
   - Timezone handling assumes device timezone (follow up with backend)
   ```

4. **context.md Diff** (changes to project documentation)
   ```
   Updated:
   - apps/mobile/store/ pattern now includes isLoaded cache guard
   - New SleepService at services/sleep.service.ts (see API reference)
   
   Or:
   "context.md update not required — no new conventions or patterns introduced."
   ```

**Exit Criteria:**
```
[ ] npm run typecheck — passes (entire monorepo)
[ ] npm run lint — passes (entire monorepo)
[ ] npm run test — passes (entire suite)
[ ] Implementation summary written and clear
[ ] Invariant checklist filled (every acceptance criterion addressed)
[ ] Residual risks listed (or "none identified")
[ ] context.md updated or "not required" declared with reason
```

---

### P4 — Hardening (Optional; Use When Present)

Use **only if** the task involves:
- Retry logic or exponential backoff
- Idempotency guards
- Rate limiting
- Race condition mitigations
- Performance-critical paths

**Exit Criteria:**
```
[ ] Targeted tests for every hardened path
[ ] P1/P2/P3 regression tests still pass
```

**Example:**

```ts
// P4: retry + idempotency
async fetchWithRetry(userId: string, date: string) {
  let lastError;
  for (let i = 0; i < 3; i++) {
    try {
      const cacheKey = `${userId}:${date}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }
      const data = await this.service.fetch(userId, date);
      this.cache.set(cacheKey, data);
      return data;
    } catch (e) {
      lastError = e;
      await sleep(Math.pow(2, i) * 100);  // exponential backoff
    }
  }
  throw lastError;
}
```

---

### P5 — Rollout / Observability (Optional; Use When Required)

Use **only if** the task requires:
- Feature flags or gradual rollout
- Structured logging or telemetry
- Database migration coordination
- Final documentation sync

**Exit Criteria:**
```
[ ] Feature flag logic tested
[ ] Logging covers critical paths
[ ] Migration is reversible and tested
[ ] Final docs reviewed and published
```

---

## Failure Protocol

When a check fails, **always:**

### 1. Stop Advancing
Do not start the next stage. Do not suppress the error.

### 2. Diagnose in One Sentence
```
❌ typecheck failed: SleepService.getAllSleep() returns Promise<SleepData>
   but SleepScreen expects SleepData (missing await in P2 component)
```

### 3. Fix the Root Cause
Do not:
- Use `@ts-ignore` or `@ts-expect-error`
- Use `eslint-disable` without specific reason
- Weaken types (make required field optional)
- Delete tests instead of fixing code

### 4. Re-run the Check
```bash
npm run typecheck
# ✓ Now passes
```

### 5. Declare Clearly
```
✓ typecheck now passes. Advancing to P1.
```

---

## Scope Guard

Tasks expand. Prevent it.

**In-scope** = explicitly mentioned or required to make an explicitly mentioned thing work.

**Out-of-scope** = improvements, refactors, additions you noticed that were not mentioned.

When you spot out-of-scope work:

```
Out-of-scope observation: SleepCard component could use memoization.
Deferring to P4 hardening phase or follow-up task.
```

List all deferred items in **P3 residual risks**.

### Blocker Detection

If an out-of-scope item is **required** for task completion:

```
⚠️ BLOCKER: Task requires SleepScreen integration but SleepService
doesn't exist yet. SleepService is out of scope per task definition,
but cannot complete without it. Confirm: should I implement P0–P1
for SleepService, or defer?
```

Wait for confirmation before proceeding.

---

## context.md Update Rules

Update `packages/docs/context.md` when:

| Changed thing                               | Update required |
| ------------------------------------------- | --------------- |
| New npm script or changed command           | Yes             |
| New path alias or import convention         | Yes             |
| New module with responsibility boundary    | Yes             |
| New API integration pattern                 | Yes             |
| New architectural constraint                | Yes             |
| New required validation step                | Yes             |
| File renamed or moved                       | Yes             |
| Bug fix or feature (no structural change)   | No              |
| UI component added (no new conventions)     | No              |

If **not required**, explicitly declare:
```
context.md update not required — changes are isolated to SleepCard
component, no new conventions or patterns introduced.
```

---

## Anti-Patterns

These are common failure modes. Do not do them.

| Anti-pattern | Why it fails |
|---|---|
| **Skip pre-flight** | Missing context.md → wrong commands, import errors, conventions violated |
| **Combine stages** | "I'll add the service while doing types" → scope explodes, checks fail mid-stage |
| **Widen types to fix errors** | `any`, `unknown` casts = deferred bugs, not fixes |
| **Advance past failing check** | Building on broken foundation → cascading failures |
| **Silent scope expansion** | Add a feature you noticed → P3 summary is inaccurate |
| **Update context.md late** | Should be updated *during* the stage where change happens |
| **Re-read context.md mid-task** | Signals incomplete pre-flight; allowed but inefficient |
| **Test "optional"** | P1 must have unit tests; P2 must have smoke-test |

---

## Execution Checklist

Copy this for each task:

```
PRE-FLIGHT
[ ] Read packages/docs/context.md in full
[ ] Read all task-specific docs
[ ] Declared stages needed (P0–P5)
[ ] Declared files per stage
[ ] Declared validation commands
[ ] No blocking ambiguities surfaced

P0 — FOUNDATIONS
[ ] Types / schemas / contracts / scaffolding complete
[ ] typecheck passes
[ ] lint passes

P1 — CORE LOGIC
[ ] Logic / services / routes complete
[ ] typecheck passes
[ ] lint passes
[ ] Relevant unit tests pass
[ ] No UI components introduced

P2 — UI INTEGRATION
[ ] Components / interactions complete
[ ] typecheck passes
[ ] lint passes
[ ] UI tests pass (if present)
[ ] Loading / error / empty states verified
[ ] Smoke-test checklist complete

P3 — QUALITY HARDENING
[ ] Full monorepo typecheck passes
[ ] Full lint passes
[ ] Full test suite passes
[ ] Implementation summary written
[ ] Invariant checklist complete
[ ] Residual risks listed
[ ] context.md updated or declared "not required"

P4 — HARDENING (if applicable)
[ ] Retry / idempotency / rate limit logic complete
[ ] Targeted tests pass
[ ] P1/P2/P3 regression tests pass

P5 — ROLLOUT (if applicable)
[ ] Feature flag logic tested
[ ] Logging coverage verified
[ ] Migration tested and reversible
[ ] Final docs reviewed
```

---

## Using This Skill in Claude Code

Invoke for complex tasks:
```
/staged-delivery-workflow

Implement the morning brief AI feature (sleep insights + recommendations).
```

Or reference in prompts:
```
Use staged-delivery-workflow pattern (P0–P3 for this task).
```

Claude will structure the work into phases, validate after each, and ensure quality gates pass before advancing.

This prevents scope creep, catches errors early, and produces clear documentation of what was built and why.
