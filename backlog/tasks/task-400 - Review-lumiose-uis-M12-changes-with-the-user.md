---
id: TASK-400
title: Review @lumiose/ui's M12 changes with the user
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-15 19:52'
updated_date: '2026-10-15 20:48'
labels:
  - ui
  - review
milestone: m-12
dependencies: []
priority: high
ordinal: 399000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User request, 2026-10-15: start M12 worker batches autonomously, and review the full UI changes together at the end. Lux records here, batch by batch, the public names the workers propose (still proposals until the user approves them; AGENTS.md) and the UI changes worth the user's look, with the showcase page or screenshot for each. Already approved on 2026-10-15: the names from TASK-356, 357, 359, 390 and 393 (decisions 62, 64 and 65).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every proposed public name from the later batches is listed with its task
- [ ] #2 The user reviewed the list and the showcase, and the approved names are recorded in the decisions
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Batch 3 (2026-10-15): TASK-358, 396, 391, 387

**Proposed public names (awaiting the user's review):**
- **TASK-358 Combobox:**
  - parts `Trigger`, `Clear`, `Chips`, `Popup`, `Group`, `GroupLabel`, `Empty`, `Status` (Base UI's names);
  - props `multiple`, `filter` (`"contains" | "startsWith" | "none"`), `name`, `required`, `disabled`, `open`/`onOpenChange`/`bind:open` on Root, `label`/`disabled` on Item, `removeLabel` on Chips;
  - type `ComboboxValue`;
  - custom commands `--toggle` and `--clear`;
  - element attribute `filter` and `data-remove-label` on the chips list;
  - ids `<id>-chips` and `<id>-empty`.
- **TASK-358 Select:** parts `Root`, `Trigger`, `Value`, `Item`, `Group` (`label`) and `Separator`.
- **TASK-358, both:** theme classes `lu-combobox` and `lu-select`; exports `/combobox`, `/combobox.css`, `/select` and `/select.css`.
- **TASK-387 site:**
  - URL paths `/ui` (Introduction) and `/ui/<page>`, with `/docs/ui/*` redirecting to them;
  - the header link "UI" and the footer link "UI components";
  - demos are the existing `tsx check` examples, with no new convention in packages/ui/docs.

**Worth the user's look:**
- the site's /ui section (live demos, Installation and Theming pages);
- Combobox and Select in the showcase (/combobox, /select and their island pages);
- the shared dismissal model across Menu, Popover and Combobox (TASK-396).
<!-- SECTION:NOTES:END -->
