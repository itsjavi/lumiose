---
id: TASK-234
title: 'Hydration: inserted children before static elements in a conditional fragment'
status: To Do
assignee:
  - Photon
created_date: '2026-10-11 02:43'
labels:
  - compiler
  - hydration
milestone: m-7
dependencies: []
priority: high
ordinal: 236000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Chime in TASK-218 (repro and details in its notes). For a fragment inside a conditional where inserted children come before static elements, for example cond ? <>{item("a")}{item("b")}<label>static</label></> : null, the client code creates the static element before the inserted children render, so it claims item("a")'s server node. The server also writes no block markers for inserts inside the fragment. Result: LUM4006, and the whole SPA island renders again on the client. Dotmatrix works around it with a display: contents div in InstrumentPanel; remove the workaround once fixed (Chime's area, so coordinate). Fix the compiler output (claim order, server markers) and/or the hydration claim cursor. The repro compiles through compile() in packages/compiler in about 10 lines.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The repro hydrates without LUM4006 or a full re-render, in client and server output, with a regression test in the compiler and an e2e hydration test
- [ ] #2 Similar shapes are covered by tests: inserts after static elements, nested fragments, .map inside a conditional fragment
- [ ] #3 Dotmatrix's display: contents workaround is removed by its owner, with its e2e passing
<!-- AC:END -->
