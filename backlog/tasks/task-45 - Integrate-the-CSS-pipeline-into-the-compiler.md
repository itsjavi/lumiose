---
id: TASK-45
title: Integrate the CSS pipeline into the compiler
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 13:59'
updated_date: '2026-10-08 14:11'
labels: []
milestone: m-1
dependencies:
  - TASK-11
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lumen_css (TASK-10) works on resolved inputs. The compiler has to feed it constants and scope information and stamp tokens into templates (decisions 12 and 14).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 $ref resolution via oxc_semantic on the masked AST, including constant folding of imported consts (requested from the host); LUM3008/LUM3013
- [ ] #2 Per-scope tokens stamped on every element in scope in client and server templates; $-only imports removed from JS output; cssDeps reported
- [ ] #3 Class passthrough: call sites pass $$scope, and children apply it via applyScope wherever props.class is applied
- [ ] #4 compile() returns css + map alongside code; golden fixtures
- [ ] #5 lumen/vite serves CSS virtual modules (File.stsx?lumen&type=style&lang.css) through the Vite CSS pipeline; style-only edits hot-update CSS without remounting; cssDeps invalidate on token edits
- [ ] #6 The TASK-11 example app gains scoped styles and $tokens, verified in a browser
<!-- AC:END -->
