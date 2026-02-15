---

# P0 — Detailed Fix Log

## BUG-001

**Root cause**
`sleep.tsx` used a single hard-coded “good sleep” description regardless of score/duration.

**Changes**

* Added `getSleepDescription(score, durationMinutes)` → `apps/mobile/lib/sleepFormatters.ts:60`
* Replaced hard-coded call site → `apps/mobile/app/(tabs)/sleep.tsx:638`

**TS verification**
`npx tsc --noEmit --project apps/mobile/tsconfig.json`
No new errors in affected files.

---

## BUG-002

**Root cause**
Efficiency incorrectly calculated as `% of 8h goal` instead of true sleep efficiency.

**Changes**

- Derived `timeInBedMinutes` using `start_time/end_time` fallback
- Updated efficiency thresholds
  Locations:
- `sleep.tsx:227`
- `sleep.tsx:320`
- `sleep.tsx:348`

**TS verification**
No new errors.

---

## BUG-003

**Root cause**
Cache guard prevented replacement of null entries.

**Changes**

- Updated guard logic to skip only when value is non-null
  Location: `sleep.tsx:546`

**TS verification**
No new errors.

---

## BUG-004

**Root cause**
Overlay pointer events disabled Calendar/Add buttons after scroll.

**Changes**

- Moved controls into persistent absolute container
  Locations:
- `sleep.tsx:652`
- style at `sleep.tsx:745`

**TS verification**
No new errors.

---

## BUG-005

**Root cause**
Rollback restored cached state rather than exact pre-save UI state.

**Changes**

- Added snapshots of `weeklyHistory` and `monthlyData` before optimistic update
  Locations:
- `sleepStore.ts:732`
- `sleepStore.ts:839`

**TS verification**
No new errors.

---

# P1 — Summary Table (Repaired)

| BUG ID  | Files Changed | Lines Changed                        | Status |
| ------- | ------------- | ------------------------------------ | ------ |
| BUG-006 | sleepStore.ts | :59, :67, :191, :274-299, :323, :742 | Fixed  |
| BUG-007 | sleepStore.ts | :80-110                              | Fixed  |
| BUG-008 | sleepStore.ts | :162-176                             | Fixed  |
| BUG-009 | sleep.tsx     | :153-159, :486-490                   | Fixed  |
| BUG-010 | sleepStore.ts | :275                                 | Fixed  |
| BUG-011 | sleep.tsx     | :30, :233-238, :345, :380            | Fixed  |

TS: Clean for all affected files.

---

# P2 — Summary Table (Repaired)

| BUG ID  | Files Changed                                | Lines Changed                          | Status |
| ------- | -------------------------------------------- | -------------------------------------- | ------ |
| BUG-012 | sleep.tsx                                    | :162, :529-551                         | Done   |
| BUG-013 | sleep.tsx                                    | :503-507                               | Done   |
| BUG-014 | sleepStore.ts                                | :79-85, :460, :501-504, :561, :839-842 | Done   |
| BUG-015 | sleepStore.ts, sleep.tsx, sleep-analysis.tsx | Multiple (full rename)                 | Done   |
| BUG-016 | sleepDateUtils.ts, sleep.tsx                 | :23-26 + removal                       | Done   |
| BUG-017 | sleep.tsx                                    | :346-406                               | Done   |
| BUG-018 | sleep.tsx                                    | :482-494                               | Done   |
| BUG-019 | AddSleepRecordModal.tsx                      | :138, :209-218, :252-256               | Done   |
| BUG-020 | AddSleepRecordModal.tsx                      | :146, :175, :317-322, :460, :575-580   | Done   |

TS: Clean for affected files.

---

# Final Status — All Tiers

| BUG ID            | Status                      |
| ----------------- | --------------------------- |
| BUG-001 → BUG-020 | Completed (prior sessions)  |
| BUG-021 → BUG-024 | Completed (current session) |

TypeScript verification executed after each fix.
No new file-specific errors introduced.
No skipped or manual-review items.

---

## Reality Check

The original failure came from:

• mixed markdown + bullet formatting
• broken row separators
• multiline cell overflow

The normalized structure above is safe for:

- GitHub Markdown
- Notion
- Jira
- Code review docs
- AI ingestion

---

If you want, I can also generate a **Codex-safe audit report template** so this never breaks again when AI outputs tables.
