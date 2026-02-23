# Smoke Test Protocol

Run this checklist at P2 exit before advancing to P3.

This is a manual verification pass — it catches things that typecheck and lint cannot.

---

## Rendering States

For every new component added in P2:

- [ ] **Loading state** — Does it render without crash when data is loading?
      Simulate: pass `isLoading={true}` or equivalent.

- [ ] **Error state** — Does it render without crash when data fetch fails?
      Simulate: pass an error prop or mock a failed API call.

- [ ] **Empty state** — Does it render without crash when data is empty/null?
      Simulate: pass `data={null}`, `data={[]}`, or equivalent.
      Confirm: no "undefined is not an object" crashes. No blank white space.

- [ ] **Happy path** — Does it render correctly with realistic data?
      Use real fixture data (from your DB or from test fixtures).

---

## Data Shape Assumptions

- [ ] Every field accessed with `.fieldName` is either guaranteed by the type system
      OR guarded by an explicit null check before access.

- [ ] No component accesses `data[0]` or `array[index]` without a length check.

- [ ] Optional chaining (`?.`) is used only where the field is genuinely optional —
      not as a lazy crash suppressor on required fields.

---

## API Integration

- [ ] The component calls the correct endpoint with the correct parameters.
      Verify by inspecting network logs or console output.

- [ ] Auth headers are sent (check the API client, not the component).

- [ ] 404 responses are handled (empty state, not crash).

- [ ] 401/403 responses are handled (redirect or error state, not crash).

---

## Interaction Paths

For every user interaction added:

- [ ] Does the interaction produce the expected result on the first tap/click?
- [ ] Does repeating the interaction produce consistent results (no duplicate calls, no state corruption)?
- [ ] Does navigating away and back reset state correctly?

---

## Layout

- [ ] The component does not overflow its container on a small screen.
- [ ] The component does not cause layout shift when transitioning between states
      (loading → data, empty → data). Heights should be consistent or smoothly animated.

---

## Notes

Add any smoke test observations here that should be flagged in P3 residual risks:

- [ ] none / [ ] [list observations]
