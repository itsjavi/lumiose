---
id: TASK-460
title: 'Combobox: back navigation restores the selection and keeps the reset default'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 13:42'
updated_date: '2026-10-16 21:44'
labels:
  - ui
milestone: m-12
dependencies: []
priority: low
ordinal: 458000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the 0.1.0 release review, TASK-454 L32 (Prism). After a back navigation, the browser restores the inner input's text and the element's form state, and the combobox then takes the restored state as its reset default (`#defaults` read from the restored options), so a later reset goes to the restored value instead of the server's. Implement formStateRestoreCallback (setFormValue with a state) and keep the server's selection as the default; check bfcache and non-bfcache in each engine.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After a back navigation the user's selection is restored, and a reset goes back to the server's default, with tests in every engine
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the fix batch 2 merge. A follow-up from the release review, not needed for 0.1.0.

2026-10-16 (Halo): claimed (final M12 batch; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): done in combobox.script.ts (merged main first; additive). Cause confirmed: on a back navigation that reloads the page, formStateRestoreCallback runs right after connectedCallback (both custom element reactions) and selects the restored options; the deferred start then read the options' aria-selected as the server's selection, so the restored choice became the reset default (and a multiple's order changed to the options' order). Now #serverDefaults() reads the server's selection once, and the restore callback reads it before applying the restored state; the start then leaves the restored choice as it is. formStateRestoreCallback already restored from setFormValue's value (a string, or FormData for multiple), so no separate state was needed. bfcache: none of the engines restores from it under Playwright (probed: the page's JS state is gone after goBack in dev, build, Firefox and WebKit); a bfcache restore keeps the scripts' state as it was, so it needs nothing. e2e 'the user's choice comes back, and a reset goes to the server's' (City and Tags) fails without the fix in dev, build, Firefox and WebKit. combobox.md updated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
After a back navigation the Combobox keeps the user's restored choice, and a form reset goes back to the server's selection; tested in every engine (none uses the bfcache under Playwright, where nothing changes).
<!-- SECTION:FINAL_SUMMARY:END -->
