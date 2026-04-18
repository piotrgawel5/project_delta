---
name: code-review
description: >
  Review changed code for quality issues specific to Project Delta's stack
  (Expo React Native, TypeScript, Zustand, NativeWind, Express/Zod).
  Flags performance problems, type safety gaps, style violations, and dead code.
  Use when you want a structured review of staged or unstaged changes before committing.
allowed-tools: Read,Grep,Glob,Bash(git diff *),Bash(git diff --stat),Bash(git diff --name-only)
---

# Project Delta — Code Review

## Changed files

```!
git diff --name-only HEAD
git diff --name-only --cached
```

## Full diff

```!
git diff HEAD
git diff --cached
```

---

Perform a thorough code review of the diff above, scoped to Project Delta's stack.
Output a **markdown report** using the structure below. Only include sections where issues are found.

---

## Review Report

### Critical
Issues that will cause crashes, data loss, security vulnerabilities, or broken type contracts.

- **[file:line]** — description of issue
  ```ts
  // suggested fix
  ```

### Warning
Issues that cause performance regressions, re-render storms, or maintainability problems.

- **[file:line]** — description of issue
  ```ts
  // suggested fix
  ```

### Info
Minor style violations, missed opportunities for reuse, or low-impact improvements.

- **[file:line]** — description of issue
  ```ts
  // suggested fix
  ```

---

## Checklist

For each changed file, check the following. Only flag actual violations found in the diff.

### Zustand store patterns (`store/*.ts`)
- [ ] Selectors are granular — no component subscribes to the whole store object
- [ ] No selector functions defined inline inside components (causes new reference every render)
- [ ] Async actions handle loading/error state; no fire-and-forget without error boundary
- [ ] `set()` calls are batched where multiple slices update together
- [ ] No store state that duplicates what's already in React Navigation params or URL

### React Native performance (`apps/mobile/**`)
- [ ] Style objects are defined outside the component body or via `StyleSheet.create()` / NativeWind classes — not as inline object literals `{{ }}` on every render
- [ ] `FlatList` / `SectionList` used for any list > 10 items (no `.map()` inside `ScrollView`)
- [ ] `useCallback` / `useMemo` used for callbacks and derived values passed to memoized children
- [ ] No synchronous heavy computation in render path — move to `useMemo` or a lib function
- [ ] Images use fixed `width`/`height` or `contentFit`; no unbound `flex: 1` on images

### Type safety
- [ ] No `any` types introduced — use `unknown` + type guard or a proper type
- [ ] API response shapes validated with Zod at the boundary (`lib/api.ts` or route handler)
- [ ] No `as SomeType` casts that bypass runtime validation
- [ ] Optional chaining (`?.`) used instead of non-null assertions (`!`) where value may be absent

### Component reuse / architecture
- [ ] UI primitives that appear in >1 screen belong in `components/` or `packages/shared/`
- [ ] No logic duplicated between a screen component and a store action — one owns it
- [ ] Nested radius follows the convention: outer = inner + padding (no single hardcoded radius across nested views)
- [ ] No hardcoded color hex values — use NativeWind classes or theme tokens from `packages/shared/src/constants/theme.ts`

### NativeWind / styling
- [ ] No inline `style={{ color: '#...' }}` where a Tailwind class exists
- [ ] Spacing uses scale values (`p-4`, `gap-2`) not arbitrary `p-[17px]` unless pixel-perfect match required
- [ ] Dark mode variants (`dark:`) added alongside light-mode classes where applicable

### Token waste / dead code
- [ ] No unused imports
- [ ] No variables assigned but never read
- [ ] No commented-out code blocks left behind
- [ ] No utility functions added that are only called once (inline instead)
- [ ] No feature-flag shims or backwards-compat wrappers for code that no longer exists

### Backend (`services/api/**`)
- [ ] All route inputs validated with Zod before use
- [ ] No raw SQL string interpolation — use parameterized queries
- [ ] Auth middleware applied to every non-public route
- [ ] No secrets or env vars hardcoded in source

---

After the checklist, add a **Summary** section:

```
Files reviewed: N
Critical: N  |  Warning: N  |  Info: N
```

If there are no issues in a severity level, omit that section entirely.
If the diff is empty or only touches non-code files (docs, assets), say so and stop.
