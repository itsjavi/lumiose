---
id: TASK-407
title: Setting value to undefined on <progress> or <meter> throws
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 23:25'
updated_date: '2026-10-16 00:21'
labels:
  - runtime
  - dom
milestone: m-12
dependencies:
  - TASK-373
priority: medium
ordinal: 406000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Halo in TASK-373 (2026-10-16). The DOM runtime writes `value` as a property, and Chrome throws when `<progress>.value` or `<meter>.value` is set to `undefined` (a non-finite double). Progress.Track works around it with an effect. Remove the attribute, or skip the write, when the value is undefined or null, as the runtime does for other nullable properties.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `<progress value={x}>` with x switching between a number and undefined works in islands, with a test
- [x] #2 Progress.Track drops its workaround
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 6. New sessions cannot start from an automated turn, so the idle Beacon session takes it; it may edit the files the fix needs.

2026-10-16 (Beacon, branch claude/beacon-m12b-ee0e55, solo takeover in batch 6): fixed in 912de956.

- `setProp` (packages/lumiose/src/dom/attributes.ts), the writer of `value`, `checked` and the other DOM properties, used to assign `undefined`. `<progress>.value` and `<meter>.value` are doubles, and Chrome (and happy-dom) throw on a non-finite one.
- Now nullish removes the attribute behind a number property: a progress bar is indeterminate again, and a meter goes back to its default. String properties are still cleared to `""`, and other values are assigned as before. A non-null value is written without reading the property first.
- Tests:
  - attributes.test.ts: progress and meter switch between numbers, `undefined` and `null`.
  - hydrate.test.ts: a compiled island with `<progress value={x()}>` and `<meter>` that starts `undefined`, hydrates without warnings, and toggles.
- Progress.Track drops its effect and its server-only spread: it now passes `value={position()}`.
- Docs: no page describes property writes, so there was nothing to update.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
setProp removes the attribute behind a number property set to nullish, so <progress>/<meter> no longer throw on undefined and a progress bar goes indeterminate; Progress.Track drops its effect (912de956). Checks: pnpm check (2295 tests), cargo fmt/clippy/test, pack:check --smoke --skip-npm, ui-e2e 519 passed (15 skipped), apps/web 159 passed (4 skipped).
<!-- SECTION:FINAL_SUMMARY:END -->
