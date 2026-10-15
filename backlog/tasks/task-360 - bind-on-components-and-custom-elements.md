---
id: TASK-360
title: 'bind: on components and custom elements'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-15 16:46'
labels:
  - ui
milestone: m-12
dependencies: []
priority: high
ordinal: 361000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike, proposal and measurements in TASK-332's notes). Approved syntax: bind:x on a component with an x prop and an onXChange callback (bind:open on Dialog.Root, bind:value on Combobox.Root, bind:checked on Menu.CheckboxItem), and on a custom element with an x property and a change event. The compiler expands it to the prop plus the callback; types come from the component's props.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bind:x compiles to x and onXChange on components and to the property and change event on custom elements, server and client
- [ ] #2 Type errors for a component without x or onXChange
- [ ] #3 concepts/jsx.md documents it
<!-- AC:END -->
