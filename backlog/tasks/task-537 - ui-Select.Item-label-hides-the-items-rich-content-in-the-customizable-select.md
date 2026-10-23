---
id: TASK-537
title: 'ui: Select.Item label hides the item''s rich content in the customizable select'
status: Done
assignee:
  - Halo
created_date: '2026-10-23 20:56'
updated_date: '2026-10-23 21:57'
labels:
  - ui
  - bug
dependencies: []
priority: medium
ordinal: 530000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From a port's @lumiose/ui pass (2026-10-23). In Chromium's customizable select, an item with `label` shows only the label text in the picker, while the button still shows the item's content. The docs recommend `label` for items that start with an icon. Repro: `<Select.Root aria-label="X"><Select.Trigger><Select.Value/></Select.Trigger><Select.Item value="a" label="Alpha"><b>★</b>Alpha</Select.Item><Select.Item value="b" label="Beta"><b>●</b>Beta</Select.Item></Select.Root>`. Workaround: omit `label` when the text content is the plain name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The picker shows each item's content with or without `label`; `label` only names the item (typeahead, the button's text where documented)
- [x] #2 A browser test covers it in Chromium, and the classic select fallback still works
- [x] #3 The Select docs match
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (commit 6fc06a11). Cause: Chromium's and WebKit's customizable select hide an option's content when it has a non-empty label (UA rule option[label]:not([label=""])::-internal-option-slot { display: none }), which no author CSS overrides; the classic select needs the attribute to show the name, so no static markup serves both. Fix: Select.Item with label renders the option's label and aria-label plus a hidden copy of the label first in its content (span hidden data-label); a new 0.2 kB client script (select/select.script.ts, loaded only when an item has a label) removes the attribute from a customizable select's labelled items on pointerdown or focusin, before its picker opens: the picker shows their content, typeahead matches the hidden copy and aria-label keeps the name. Classic selects keep the attribute; without the script the customizable picker shows the labels, as before. Side effect, documented: option.text and selectedcontent's textContent start with the label (the rendered text does not). Tests: select.test.tsx (server HTML), select.script.dom.test.ts, ui-e2e select.e2e.ts: the picker shows labelled items' content and typeahead matches the label (fails without the script), and a classic labelled select (new section on /select) shows its labels and matches them in every browser. Docs: select.md (label row and paragraph, a client script section, the typeahead note), the ui README row. Select is no longer script-free for labelled items: worth a look from the user.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Labelled Select items show their content in the customizable picker; label names the item (typeahead, aria-label, the classic select). A 0.2 kB script, loaded only for labelled items, does it; Chromium, Firefox and WebKit e2e cover the customizable and classic selects.
<!-- SECTION:FINAL_SUMMARY:END -->
