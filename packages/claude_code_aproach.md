Recommended Workflow for Project Delta

Your .claude/ setup is now a multi-layer framework. Here's how to use it effectively:

1. For Feature Implementation (primary workflow)

Start with the planner agent:
@planner Implement [feature description]

This produces a P0–P5 breakdown with:

- Exact files to create/modify per stage
- Architectural constraints to enforce
- Open questions before you proceed

Then execute with /implement:
/implement [feature description]

This narrows scope to the declared stages and validates after each one.

---

2. For Code Review (before committing)

Use the reviewer agent:
@reviewer

It auto-reads git diff and produces Critical/Warning/Info report scoped to Project Delta's stack (Zustand, Reanimated, SLEEP_THEME, Zod, etc.).

---

3. For Bug Fixes (targeted, minimal)

/fix [issue]

Focuses on root cause, validates with typecheck/lint, avoids scope creep.

---

4. For Architecture Questions (before designing)

@explorer [area: "sleep engine" / "auth flow" / "fetch pattern"]

Produces file trees, data flow traces, and pattern summaries without speculating.

---

5. For Quality Audits (catching violations)

/audit apps/mobile/components/sleep

Scans for:

- Hardcoded colors (must use SLEEP_THEME)
- Waterfall fetches (must use Promise.all)
- Wrong animation library (must be Reanimated 4)
- Unused imports, dead code, etc.

---

Prompting for Maximum Potential

✓ Strong Prompts (how to ask)

@planner Add premium sleep timeline fetch to SleepScreen.
This should:

- Fetch from GET /sleep/:userId/timeline/:date (already exists)
- Display in SleepHypnogram component (already exists)
- Hide behind isPaidPlan gate
- Cache the timeline in sleepStore
  Plan only — no code yet.

Why this works:

- Specific scope (which screen, which component, which gate)
- References existing code (shows you've read the codebase)
- Declares intent ("Plan only" = expect structured breakdown, not implementation)
- Constraints implicit (sleepStore = batch fetches, isPaidPlan = guards)

---

✗ Weak Prompts (don't do this)

/implement improve sleep UI

Problems:

- Vague scope (which UI? which screen?)
- No reference to existing patterns
- No acceptance criteria
- Will trigger multiple guesses, not focus

---

Settings & Automation

Your settings.json has:

1. Post-write Prettier hook — auto-formats mobile code after write
2. Permission deny list — blocks .env reads, git push --force, destructive Supabase commands
3. Permission allow list — whitelist for npm scripts, git reads, tests

This means:

- Write code freely — Prettier runs automatically
- No accidental .env leaks
- No force-push disasters

---

Stage-Based Workflow (Multi-File Tasks)

For complex tasks:

P0 (types) → validate typecheck
P1 (logic) → validate lint + tests
P2 (UI) → validate with screenshots
P3 (quality) → full monorepo lint/test + summary

Each stage gates the next. If P0 fails typecheck, you stop and fix before P1.

This is built into the staged-delivery-workflow skill — reference it in /implement:

/implement [feature]
Use staged-delivery-workflow (P0–P3 for this).

---

Your Day-to-Day Loop

1. Task arrives → /implement or @planner → get breakdown
2. Build P0 → npx tsc --noEmit -p apps/mobile/tsconfig.json → continue if passes
3. Build P1 → npm run lint + npx jest → continue if passes
4. Build P2 → visual validation (screenshots vs Figma)
5. Git diff → @reviewer → fix Critical/Warning issues
6. Commit → conventional commits with scope (feat(sleep):)

---

Pro Tips

┌──────────────────────────────┬───────────┬──────────────────────────────────────────┐
│ Goal │ Tool │ Example │ |  
├──────────────────────────────┼───────────┼──────────────────────────────────────────┤
│ Understand existing pattern │ @explorer │ @explorer "How does batch sync work?" │
├──────────────────────────────┼───────────┼──────────────────────────────────────────┤
│ Plan before coding │ @planner│ @planner Add offline retry logic │
├──────────────────────────────┼───────────┼──────────────────────────────────────────┤
│ Catch mistakes before commit │ @reviewer │ Run after staging changes │
├──────────────────────────────┼───────────┼──────────────────────────────────────────┤
│ Audit a codebase area │ /audit │ /audit apps/mobile/lib/sleep\*.ts │
├──────────────────────────────┼───────────┼──────────────────────────────────────────┤
│ Quick bug fix │ /fix │ /fix waterfall fetches in SleepScreen │
├──────────────────────────────┼───────────┼──────────────────────────────────────────┤
│ New screen template │ /screen │ /screen ProfileScreen │
├──────────────────────────────┼───────────┼──────────────────────────────────────────┤
│ New API endpoint │ /endpoint │ /endpoint POST /api/sleep/timeline/:date │
└──────────────────────────────┴───────────┴──────────────────────────────────────────┘

---

What NOT to Do

- ❌ Don't ask Claude Code to implement without a plan first
- ❌ Don't skip stage validation gates ("it probably works")
- ❌ Don't add features beyond the declared scope (scope creep kills staged delivery)
- ❌ Don't ignore @reviewer warnings before committing
- ❌ Don't hardcode colors, spacing, or animation libraries — the skills catch this

---

You've built a framework that enforces your project's standards automatically. Use it.
