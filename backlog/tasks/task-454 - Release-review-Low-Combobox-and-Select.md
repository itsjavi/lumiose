---
id: TASK-454
title: 'Release review, Low: Combobox and Select'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 13:43'
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
- [x] #1 L32: Combobox, smaller issues:
  - an external `--toggle` invoker can't close the popup (openchange true, false, true);
  - after back navigation, the restored state
- [x] #2 L33: Select:
  - options starting with an icon break typeahead in 3 engines; document `label` on Select.Item and use it in the fixture;
  - the docs and e2e are stal
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for release-review fix batch 2 (it fixed the related Highs in batch 1).

2026-10-16 (Beacon): L32 fixed: an outside --toggle invoker closes the popup (its command right after the outside press that closed it no longer reopens it); aria-expanded is set with the popup (and on Trigger buttons), not on toggle a task later; a reset removes aria-invalid outside a field; Autocomplete's submitOnItemClick submits on Enter too; the listbox is named by the field's label inside a Field; the Trigger has aria-haspopup, aria-controls and aria-expanded; Autocomplete options carry no aria-selected. Tests: combobox.test.tsx and autocomplete.test.tsx (server HTML), ui-e2e combobox-review.e2e.ts 'Combobox Lows (TASK-454, L32)' in Chromium, Firefox and WebKit. Recorded: back navigation is TASK-460; keyboard chips are TASK-461; Escape on a closed combobox is a parity call added to TASK-457. L33: Select.Item `label` documented and used in the fixture (emoji options); the typeahead test fails without it; WebKit 26.6 has customizable select (the suite now skips by feature, and runs the flows in WebKit; Tab leaves focus on the control in Chromium only); Firefox 155 keeps the Trigger, so the parser caveat now names older browsers. Docs: combobox.md, autocomplete.md, select.md.
<!-- SECTION:NOTES:END -->
