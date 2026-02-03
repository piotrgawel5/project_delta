---
description: Correctness is mandatory. Wrong output is unacceptable.
---

## Scope

This workflow applies to:

- Backend code changes
- DevOps / CI / security / infrastructure
- Native mobile integrations (iOS / Android / Expo native modules)

Correctness is mandatory. Wrong output is unacceptable.

---

## Model Policy

- Use **Opus 4.5 ONLY** for final execution.
- All discovery, planning, and validation must use cheaper models.
- Opus must never be used for exploration or guessing.

---

## Workflow

### Step 0 — Context Lock

- Load only relevant paths and files.
- Persist known facts: codebase structure, tech stack, constraints.
- Reference files by path. Do not paste large files.

**Output:**

- Bullet summary (≤150 tokens)

---

### Step 1 — Risk & Scope Scan

- Identify affected modules.
- Identify platform boundaries (JS / iOS / Android / infra).
- List potential failure points.

**Output:**

- Checklist of touched areas

---

### Step 2 — Execution Plan

- Convert intent into ordered steps.
- One action per step.
- No alternatives.
- No implementation details yet.

**Output:**

- Ordered task list

---

### Step 3 — Final Execution (Opus 4.5)

- Produce minimal, production-grade changes.
- No refactors unless explicitly required.
- No architectural changes unless explicitly requested.

**Output (exactly one):**

- Unified diff OR full file replacement

---

### Step 4 — Validation

- Check logic correctness.
- Check platform and environment assumptions.
- Detect missing edge cases.

**Output:**

- PASS or FAIL
- If FAIL → minimal correction diff only

---

## Hard Constraints

- Never assume undocumented environment variables or services.
- Never hallucinate APIs, configs, or platform behavior.
- If required info is missing → stop and ask.

---

_End of backend workflow._
