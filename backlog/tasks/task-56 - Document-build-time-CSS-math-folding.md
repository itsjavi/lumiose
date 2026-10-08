---
id: TASK-56
title: Document build-time CSS math folding
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-08 15:54'
labels: []
milestone: m-5
dependencies:
  - TASK-55
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Because $refs are substituted before Lightning CSS parses style blocks, any math whose operands are concrete, compatible values is precomputed at build time: calc($gap * 2px) becomes 16px, min/max/clamp/trig fold, and partial folding happens in mixed expressions. Custom properties are folded too (TASK-55). The user wants this presented to humans and agents as a benefit of Lumen's CSS pipeline, crediting Lightning CSS.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docs/concepts/styles.md gains a 'Build-time math' section: what folds (examples table), what can't (%, vw, em/rem, var(): context-dependent) and why, custom properties, credit to Lightning CSS
- [ ] #2 The reference page and the styles 'Common mistakes' mention it where relevant; llms.txt/llms-full.txt regenerated; examples marked check pass
<!-- AC:END -->
