---
id: TASK-208
title: 'Agent evals: Next.js and React Router baseline'
status: To Do
assignee:
  - Quasar
created_date: '2026-10-10 22:41'
updated_date: '2026-10-15 04:20'
labels:
  - evals
  - positioning
milestone: m-5
dependencies:
  - TASK-207
priority: low
ordinal: 210000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-37 (positioning, approved by the user 2026-10-11; notes in .local/positioning/): follow-up to the repeats. Port the eval tasks to Next.js and React Router (equivalent prompts and hidden tests) so the agent pass rate can be compared with frameworks the models already know. Upgrades the landing claim once done.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Equivalent tasks with hidden tests exist for Next.js and React Router, validated against reference solutions
- [ ] #2 A committed run compares the three frameworks per model, and doc-5 describes how the tasks were made equivalent
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15, decision-57 (user): TASK-325 is folded into this task. The published comparison runs against Next.js 16 only (React Router dropped from the baseline), on the fullstack benchmark's tasks, measuring first-try success, diagnostics hit and tokens. Propose the budget to the user before anything runs; results are published through TASK-243.
<!-- SECTION:NOTES:END -->
