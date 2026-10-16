---
id: TASK-454
title: 'Release review, Low: Combobox and Select'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 12:34'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: low
ordinal: 452000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Combobox and Select. Fix each, or record why it stays.

**Combobox and Select**
- **L32.** Combobox, smaller issues:
  - an external `--toggle` invoker can't close the popup (openchange true, false, true);
  - after back navigation, the restored state becomes the reset default;
  - `aria-invalid` stays after a reset without a Field;
  - chips aren't keyboard-reachable (BU arrows into them);
  - Escape on a closed combobox does nothing (BU clears it; parity call);
  - Autocomplete submitOnItemClick ignores Enter;
  - `aria-expanded` lags `aria-activedescendant` by a task;
  - the listbox has no name inside a Field;
  - the Trigger lacks expanded, controls and haspopup;
  - Autocomplete options carry `aria-selected="false"`.
- **L33.** Select:
  - options starting with an icon break typeahead in 3 engines; document `label` on Select.Item and use it in the fixture;
  - the docs and e2e are stale: WebKit 26.6 supports customizable select (the suite skips it; the flows pass), and Firefox 155 no longer drops the Trigger, so the parser and LUM4006 caveat is outdated.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L32: Combobox, smaller issues:
  - an external `--toggle` invoker can't close the popup (openchange true, false, true);
  - after back navigation, the restored state
- [ ] #2 L33: Select:
  - options starting with an icon break typeahead in 3 engines; document `label` on Select.Item and use it in the fixture;
  - the docs and e2e are stal
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for release-review fix batch 2 (it fixed the related Highs in batch 1).
<!-- SECTION:NOTES:END -->
