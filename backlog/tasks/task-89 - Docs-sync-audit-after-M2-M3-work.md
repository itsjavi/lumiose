---
id: TASK-89
title: Docs sync audit after M2/M3 work
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-08 21:02'
labels: []
milestone: m-5
dependencies:
  - TASK-80
priority: high
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Several features landed after the docs were written (TASK-32), and the user noticed a feature commit without docs (TASK-79). Audit the docs against the implemented features and fix every gap, so docs reflect the current state.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every feature committed since TASK-32 is documented accurately: decision-23 subtree scoping (done by Lux in 3dc3242, verify), hydration and the island loader (TASK-18, see TASK-87), lumen dev/build/preview and adapter-node (TASK-24/26), form actions/submit/fetchJSON/busy (TASK-23/44, decision-20), the CLI JSON envelope, typegen and routes (TASK-28), lumen({ mode, ssr, … }) (TASK-77, decision-21), the CSS diagnostics LUM3017–3019 (TASK-76/67), and the compiler meta changes
- [ ] #2 Status notes that say 'not yet' are removed or updated; docs:check and the docs tests pass; llms files regenerated
<!-- AC:END -->
