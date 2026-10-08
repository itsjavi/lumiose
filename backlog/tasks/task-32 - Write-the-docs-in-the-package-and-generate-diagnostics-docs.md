---
id: TASK-32
title: Write the docs in the package and generate diagnostics docs
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:21'
labels: []
milestone: m-5
dependencies:
  - TASK-9
  - TASK-10
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agents and humans need version-matched local docs that follow one pattern, plus generated pages for every diagnostic (decision-10).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 packages/lumen/docs follows the concept → API → example → common mistakes → diagnostics pattern for every concept in spec §4-§8
- [ ] #2 Diagnostics pages generated from the registry; lumen docs and lumen explain read them; llms.txt and llms-full.txt are generated
- [ ] #3 Docs examples are type-checked in CI
<!-- AC:END -->
