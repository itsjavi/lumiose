---
id: TASK-191.2
title: 'Rename sweep: examples, apps, tooling, benchmarks and evals'
status: To Do
assignee:
  - Beacon
created_date: '2026-10-10 18:17'
labels:
  - api
  - dx
dependencies: []
parent_task_id: TASK-191
priority: high
ordinal: 199000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-35. After the runtime renames land (TASK-191.1), update every consumer outside packages/lumiose/src and packages/vite: examples/**, apps/**, packages/{cli,create,site-kit,testing,language-server,vscode,eslint-plugin,prettier-plugin}, benchmarks/** (Lumiose apps only), evals/tasks. Same rename list as TASK-191.1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No consumer uses an old name (grep proof); pnpm check green; examples build and their e2e suites that touch renamed APIs pass
- [ ] #2 llms.txt/llms-full.txt regenerated
<!-- AC:END -->
