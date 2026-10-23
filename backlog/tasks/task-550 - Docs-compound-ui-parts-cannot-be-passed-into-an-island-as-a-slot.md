---
id: TASK-550
title: 'Docs: compound ui parts cannot be passed into an island as a slot'
status: To Do
assignee:
  - Halo
created_date: '2026-10-23 22:12'
labels:
  - ui
  - docs
dependencies: []
priority: low
ordinal: 542000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From a port's forms, actions and auth slice (2026-10-24). An island renders `<Combobox.Root><Combobox.Input/><Combobox.List>{props.options}</Combobox.List></Combobox.Root>` and the page passes `options={items.map((i) => <Combobox.Item value={i}>{i}</Combobox.Item>)}`: SSR throws "Combobox parts must be inside <Combobox.Root>", since slots render in the page's context. Workaround: pass the data as props and render the items inside the island.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The Islands docs (slots) and the ui docs (compound components) say that a part rendered in a slot does not see its Root inside the island, with the props workaround
- [ ] #2 The error message points at the slot case when it can
<!-- AC:END -->
