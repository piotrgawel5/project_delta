---
description: Completeness and visual fidelity are mandatory.
---

# Frontend / UI Workflow (Gemini Pro 3 High)

## Scope

This workflow applies to:

- UI components and screens
- Layout, styling, animations
- UX flows and visual hierarchy

Completeness and visual fidelity are mandatory.

---

## Model Policy

- Use **Gemini Pro 3 High** for all steps in this workflow.
- Do not escalate to Opus unless backend logic is required.

---

## Workflow

### Step 0 — Visual Grounding

- Load UI references from `packages/docs/reference_assets`.
- Treat references as ground truth, not inspiration.
- Match platform feel (iOS-first where applicable).

**Output:**

- Short description of dominant UI patterns

---

### Step 1 — Scope Definition

- Identify target screens/components.
- Identify required states (loading, error, empty).
- Confirm platform assumptions.

**Output:**

- Explicit scope list

---

### Step 2 — Single-Path Implementation

- Produce final UI directly.
- No multiple variants.
- No placeholders.
- No generic gray cards, Material defaults, or outdated gradients.

**Output:**

- Component or screen implementation

---

### Step 3 — UX Sanity Check

- Verify spacing consistency.
- Verify touch target sizes.
- Verify visual hierarchy and motion polish.

**Output:**

- Short checklist confirmation

---

## Escalation Rule

- If state management or logic becomes complex → stop and escalate to Backend Workflow.

---

## Hard Constraints

- Do not ignore provided UI references.
- Do not invent design systems.
- Do not simplify visuals to defaults.

---

_End of frontend workflow._
