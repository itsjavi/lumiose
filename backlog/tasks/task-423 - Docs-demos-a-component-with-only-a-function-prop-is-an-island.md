---
id: TASK-423
title: 'Docs demos: a component with only a function prop is an island'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-16 03:39'
labels:
  - docs
  - web
milestone: m-12
dependencies: []
priority: low
ordinal: 421000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Halo in TASK-405 (2026-10-16). apps/web's ui:demos generator does not treat an example whose only client need is a function prop (for example `validate=`) as an island, so the live demo renders without it. Halo worked around it in field.md's example.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The generator hydrates such an example as an island, or the docs contract rejects it with a clear message
<!-- AC:END -->
