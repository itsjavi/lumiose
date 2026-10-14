---
id: TASK-292
title: Flaky paraglide compile in the macOS typecheck
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-14 08:33'
labels:
  - ci
  - flaky
  - examples
dependencies: []
priority: medium
ordinal: 294000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In CI run 38534738767, the macOS check failed in `pnpm typecheck`. The step `paraglide-js compile` in examples/ssr-i18n-paraglide failed with "LixError: Lix open did not settle within 30000ms". That timeout is hardcoded in the inlang SDK. `pnpm typecheck` runs about 40 packages in parallel (nuxt, next and others), which starves the 3-vCPU macOS runner. Earlier macOS runs passed, so this is load-dependent, not a code break. Options: run the paraglide compile once before the parallel typecheck (for example in a prepare step), commit the generated src/paraglide output, or retry the compile.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The paraglide example's typecheck no longer depends on the inlang project opening within 30s under parallel load
- [ ] #2 Three consecutive macOS CI runs pass the typecheck step
<!-- AC:END -->
