---
id: TASK-38
title: Review the sample apps and framework DX
status: Done
assignee:
  - '@Prism'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-09 04:20'
labels: []
milestone: m-6
dependencies:
  - TASK-35
  - TASK-36
  - TASK-37
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An independent review of the three apps shows where the framework's DX, performance or docs fall short before release.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A findings report covers DX friction, bugs, performance, bundle sizes and docs gaps, with severity
- [x] #2 Lux records follow-up tasks from the findings
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Prism report summary (2026-10-09): High: LUM4003 not enforced (secrets ship to islands) → TASK-116; booleanish/ARIA static folding wrong → TASK-117. Medium: MPA submit reload in ReadingListToggle → TASK-118; LUM2001 props.params → TASK-109; LUM4002 only at request time → TASK-119; silent CSS mistakes → TASK-120; 9 render-blocking stylesheets + no compression → TASK-121; SSG not on native .md (needs a headings export, proposal B4). Low: diagnostics polish/agent DX → TASK-122; size enforcement + SPA modulepreload → TASK-123; sample hygiene → TASK-124; static preview + headers → TASK-125. Proposals for the user: B1 typed actions (ActionContext<"/route">, actionData<typeof actions>()), B2 LayoutProps<"/path">, B3 route identity in lumen/router, B4 headings export from .md, B5 lumen({ headers }), B6 create-lumen --mcp.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prism's review (17 ordinary findings, 6 API proposals) is recorded: TASK-116..125, TASK-109 raised to MEDIUM, decision-20 amendment revised (MPA submit no longer reloads). API proposals B1–B6 went to the user. Report in the TASK-38 notes.
<!-- SECTION:FINAL_SUMMARY:END -->
