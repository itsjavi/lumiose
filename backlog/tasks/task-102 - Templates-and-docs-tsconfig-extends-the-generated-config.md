---
id: TASK-102
title: 'Templates and docs: tsconfig extends the generated config'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-08 21:59'
labels: []
milestone: m-5
dependencies:
  - TASK-73
priority: medium
ordinal: 102000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user decided (decision-25) that new projects' tsconfig.json extends .lumen/tsconfig.generated.json, so Lumen keeps rootDirs, includes and JSX settings in sync, including workspace .stsx packages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 create-lumen templates and lumen agents init write a minimal tsconfig.json extending ./.lumen/tsconfig.generated.json; the generated file includes everything from spec §4.7; lumen check stops warning when a project extends it
- [ ] #2 Examples and apps in the repo switched where it simplifies them; docs (getting-started, reference/tsconfig or cli) updated in the same commits
<!-- AC:END -->
