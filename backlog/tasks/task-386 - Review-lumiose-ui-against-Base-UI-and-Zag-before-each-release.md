---
id: TASK-386
title: Review @lumiose/ui against Base UI and Zag before each release
status: To Do
assignee:
  - '@Prism'
created_date: '2026-10-15 16:55'
labels:
  - ui
  - review
milestone: m-12
dependencies: []
priority: high
ordinal: 387000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Before each @lumiose/ui 0.x release and before its 1.0: an independent review of every shipped primitive against Base UI's and Zag/Ark's behaviour and tests, and the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark), run in the browser (keyboard, pointer, touch emulation, RTL, nested layers). Prism is read-only: it returns findings to Lux, who records them as tasks. The checklist is updated with what each review finds.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each release has a recorded review with its findings as tasks
- [ ] #2 The pitfall checklist is updated after each review
<!-- AC:END -->
