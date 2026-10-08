---
id: TASK-63
title: Expose execution-contract meta from the compiler
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 16:03'
labels: []
milestone: m-4
dependencies:
  - TASK-45
priority: low
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The language server can show per-expression execution contracts in hovers (tracked, untracked, once or deferred: spec §5.1), but compile() meta has no such data. Beacon proposed the shape in TASK-48.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CompileOptions.contract?: boolean; CompileMeta.contract?: Array<{ span, kind: tracked|untracked|once|deferred, site: child|attribute|prop|event|…, component?, via?, reads?: Span[] }> with UTF-16 spans through napi
- [ ] #2 Golden fixtures; the language server shows the contract in hovers (Beacon follow-up note)
<!-- AC:END -->
