---
id: TASK-523
title: LUM2003 rejects early returns in components that only render on the server
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-23 08:17'
updated_date: '2026-10-23 09:11'
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
- [x] #1 A decision is recorded on early returns that read only props
- [x] #2 The direct and the local-variable forms get the same diagnostic, with tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-23): no reliable per-component signal exists for "server-only" outside serverRoute (the compiler sees one module; check, the language server and dev would each need the client graph), so the diagnostic is scoped by the kind of read (decision-77). analyze/reactivity.rs: reads carry a ReadKind (Signal for zero-argument calls, Prop for props member reads, destructured props and zero-argument methods of a prop value such as props.title.trim()); strongest_read() also follows derived locals. analyze/mod.rs: component frames record locals declared from a reactive value (LUM2001 rules, transitively, strongest kind); LUM2003 checks if and switch statements with returning branches (discriminant and case tests); Signal stays an error, Prop is a warning with its own message and help; a read through a local labels its declarator. LUM2001 is unchanged (its derivation runs without the locals). Tests: compile_api.rs early_returns_on_props_warn_in_every_form (direct if, local + switch, direct switch, destructured + transitive locals, server route) and early_returns_on_signals_are_errors_in_every_form (accessor prop, signal through a local, case test, async); diagnostics.tsx golden gains an Account component. Repo scan with the new binding: apps/web src/ui-demos/index.tsx UiDemo (switch on props.id) now gets the warning (lumiose check: 0 errors, 1 warning); the docs page route gets nothing with serverRoute. Found: LUM2001 misses `const n = count()` (an identifier call counts as a factory call), although the agents guidance says it warns; LUM2003 derived locals follow the same rule. Proposed to Lux as tasks (not created here, to avoid task id clashes with parallel worktrees). Docs: errors/LUM2003.md, concepts/components.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LUM2003 now separates signal reads (error, as before) from prop reads (warning: stale only if the component renders in the browser and a parent passes a changing value), and treats the direct, local-variable and switch forms alike (decision-77). Server routes and async components unchanged. Tested in compile_api.rs and the diagnostics golden; docs in errors/LUM2003.md and concepts/components.md.
<!-- SECTION:FINAL_SUMMARY:END -->
