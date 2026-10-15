---
id: TASK-358
title: Combobox and Select
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-15 16:46'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
  - TASK-354
priority: high
ordinal: 359000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike, proposal and measurements in TASK-332's notes). Combobox.Root (lu-combobox, form-associated), Label, Input (role="combobox"), List (role="listbox" popover), Item (role="option" data-value), with the value/label split (the input shows the label, value is data-value); then groups, empty and status states, clear, multiple with chips, validation, async options, and Select.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Combobox and Select follow their APG contracts and submit with forms
- [ ] #2 value/onValueChange and bind:value work with signals; the input shows the label
- [ ] #3 Keyboard-contract and axe tests pass
<!-- AC:END -->
