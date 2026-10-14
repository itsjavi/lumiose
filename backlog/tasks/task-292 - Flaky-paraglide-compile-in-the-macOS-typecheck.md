---
id: TASK-292
title: Flaky paraglide compile in the macOS typecheck
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-14 08:33'
updated_date: '2026-10-14 08:57'
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
- [x] #1 The paraglide example's typecheck no longer depends on the inlang project opening within 30s under parallel load
- [x] #2 The macOS CI check passes the typecheck step after the change
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Solo takeover by Lux, at the user's request. The 30s limit is OPEN_TIMEOUT_MS in @lix-js/sdk (worker/repository-protocol.js), hardcoded with no option or env override. Fix (f57dfba6): the root `typecheck` runs this example's typecheck on its own first, then the parallel run of the other packages (`--filter=!@lumiose-examples/ssr-i18n-paraglide`). The example's own typecheck script is unchanged, so it still works standalone. Locally, with src/paraglide removed, `pnpm typecheck` passes in 12.3s, against 11.2s before.

CI run 38537558073 is green on all seven jobs. The macOS check passed in 7m14s, including the typecheck step.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The root typecheck runs the Paraglide example alone, before the parallel run, so Paraglide's hardcoded 30s project-open limit no longer races about 40 typechecks on the macOS runner. CI is green on Linux, macOS and Windows.
<!-- SECTION:FINAL_SUMMARY:END -->
