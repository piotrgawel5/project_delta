# Scope Classification Guide

Use this when you're unsure whether something is in scope or out of scope.

---

## The Core Question

> "Was this explicitly requested in the task prompt, or is it required to make something that was explicitly requested work?"

If YES → in scope.  
If NO → out of scope. Log it. Defer it.

---

## Classification Examples

### In scope

| Observation                                                          | Why in scope                               |
| -------------------------------------------------------------------- | ------------------------------------------ |
| The new endpoint needs auth middleware                               | Required for the endpoint to work securely |
| The type definition needs an additional field to satisfy a new query | Required for the task to typecheck         |
| The component needs an empty state to not crash                      | Required for the feature to be shippable   |
| A test fails because your new code changed a shared utility          | You caused the regression — you fix it     |

### Out of scope

| Observation                                          | Why out of scope          |
| ---------------------------------------------------- | ------------------------- |
| A nearby component has the same bug you're fixing    | Not mentioned in the task |
| A utility function could be refactored for clarity   | Not blocking anything     |
| Another endpoint uses a pattern you just improved    | Not your task             |
| A pre-existing lint error in an unrelated file       | Not introduced by you     |
| You noticed a performance improvement you could make | Not requested             |

---

## The Blocker Test

An out-of-scope item is a **blocker** only if:

> "I literally cannot complete the explicitly requested task without doing this."

Examples of genuine blockers:

- The type you need doesn't exist yet and must be created in a shared package
- The utility function has a bug that makes your new feature produce wrong output
- The database table doesn't exist yet (migration needed before the service can run)

Examples of false blockers (they feel necessary but aren't):

- "The code quality would be better if I refactored this first"
- "I want to clean up this file before adding to it"
- "The existing tests are poorly structured"

---

## What to Do with Out-of-Scope Items

1. **Do not implement.** Even if it would take 5 minutes.
2. **Log the observation:**
   ```
   [OUT-OF-SCOPE] Noticed: [description of what you found].
   Deferring — not required for this task.
   ```
3. **Add to P3 residual risks** so a future task can address it explicitly.

---

## What to Do with Blockers

1. **Stop immediately.** Do not work around it.
2. **State clearly:**
   ```
   [BLOCKER] Cannot complete [specific part of task] without [specific out-of-scope change].
   The change required: [description].
   This was not in the task scope. Proceeding requires scope expansion — confirm?
   ```
3. **Wait for explicit confirmation before touching anything out of scope.**
