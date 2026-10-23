---
id: TASK-537
title: 'ui: Select.Item label hides the item''s rich content in the customizable select'
status: In Progress
assignee:
  - Halo
created_date: '2026-10-23 20:56'
updated_date: '2026-10-23 20:58'
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
- [ ] #1 The picker shows each item's content with or without `label`; `label` only names the item (typeahead, the button's text where documented)
- [ ] #2 A browser test covers it in Chromium, and the classic select fallback still works
- [ ] #3 The Select docs match
<!-- AC:END -->
