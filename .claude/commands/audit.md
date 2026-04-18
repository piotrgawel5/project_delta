# /audit $ARGUMENTS

Audit the following area of Project Delta for quality issues:

**$ARGUMENTS**

## Steps

1. Run the code-review skill against recent changes
2. Check mobile quality standards if `$ARGUMENTS` involves `apps/mobile/`
3. Produce a prioritized report with actionable fixes

## Automated Checks

```bash
# Changed files
git diff --name-only HEAD
git diff --name-only --cached

# Type errors
npx tsc --noEmit -p apps/mobile/tsconfig.json
npx tsc --noEmit -p services/api/tsconfig.json

# Lint
cd apps/mobile && npm run lint

# Tests
npx jest apps/mobile/lib/__tests__

# Hardcoded colors (must be empty)
grep -rn 'slate-\|#[0-9a-fA-F]\{3,6\}' apps/mobile/components/ apps/mobile/app/ --include="*.tsx" --include="*.ts"

# NEON/slate classes
grep -rn "slate-[0-9]\|gray-[0-9]\|zinc-[0-9]" apps/mobile/ --include="*.tsx"

# Waterfall fetches
grep -rn "useEffect" apps/mobile/app/ apps/mobile/components/ --include="*.tsx" -l

# JS-thread animation
grep -rn "useNativeDriver: false\|Animated\.Value\|Animated\.timing\|Animated\.spring" apps/mobile/ --include="*.tsx" --include="*.ts"
```

## Report Format

```markdown
## Audit: $ARGUMENTS

### Critical
<!-- crashes, data loss, security, broken types -->

### Warning
<!-- perf regressions, re-render storms, maintainability -->

### Info
<!-- style, reuse opportunities, minor improvements -->

### Passed Checks
<!-- explicitly note what was checked and found clean -->

### Summary
Files audited: N | Critical: N | Warning: N | Info: N
```

Focus on actual violations found — not theoretical issues.
