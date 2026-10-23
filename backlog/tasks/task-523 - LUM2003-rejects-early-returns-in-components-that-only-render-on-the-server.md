---
id: TASK-523
title: LUM2003 rejects early returns in components that only render on the server
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-23 08:17'
labels:
  - diagnostics
  - dx
milestone: m-13
dependencies: []
priority: low
ordinal: 517000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by a port of a private app of the author's (TASK-492, doc-11). A component that never runs in an island and picks its markup with early returns on a prop (if (props.kind === "a") return <A />; …) gets LUM2003 as an error, which fails lumiose check, although its props never change. The same logic through a local (const kind = props.kind; switch (kind) { case … return … }) passes, so the diagnostic is also inconsistent. The port rewrote the component as a ternary chain. Related: TASK-290 (LUM2001 warnings in server-only components), which this port hit 19 times.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision is recorded on early returns that read only props
- [ ] #2 The direct and the local-variable forms get the same diagnostic, with tests
<!-- AC:END -->
