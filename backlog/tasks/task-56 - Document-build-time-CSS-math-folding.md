---
id: TASK-56
title: 'Document JS values in styles, including build-time math'
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-08 15:54'
updated_date: '2026-10-08 16:07'
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
The user wants build-time math documented together with the section on using JS values in styles ($name), so readers see in one place what can be used, what can't (e.g. function calls) and what gets precomputed. JS constants are folded by the Lumen compiler; CSS math on concrete values is folded by Lightning CSS (calc/min/max/clamp/trig; custom properties via TASK-55).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docs/concepts/styles.md has one section "JS values in styles" covering: what $name/$obj.key can reference (top-level and component consts, imported export consts, statically evaluable literals/template literals/arithmetic/as-const objects), what cannot (function calls, let, signals/props, array indexing) with the diagnostics, where values may appear (values and @media/@container/@supports, not selectors, strings, url()), and the style-prop bridge for runtime values
- [ ] #2 A "Build-time math" subsection in that section: examples table of what folds and what stays (%, vw, em/rem, var() are context-dependent), custom properties, credit to Lightning CSS
- [ ] #3 Reference, common mistakes and llms files updated; examples marked check pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Probe the compiler (packages/compiler binding + fresh release build of the working tree for TASK-55) for every claim: what folds, LUM3008/3009/3013 messages, where $ is substituted (values, @media/@container/@supports; not selectors, strings, comments, url()).
2. styles.md: replace the $name/runtime paragraphs with '### JS values in styles' at the end of Concept (concept pages keep the 5 fixed ## sections): can/cannot table with diagnostics and fixes, positions, style-prop bridge; '#### Build-time math' with the verified table, context-dependent units, custom properties (TASK-55), Lightning CSS credit. Update the outdated CSS-pipeline status note (TASK-45 done).
3. API table / Common mistakes / Related diagnostics in styles.md; LUM3008/LUM3009 'Reported by' (now reported); compiler.md, vite.md and README status rows if outdated.
4. pnpm --filter lumen docs:gen; vitest src/cli/docs (examples marked check), docs:check, oxfmt on touched docs.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (session beacon-task56-20261008T160359Z) claimed TASK-56.
<!-- SECTION:NOTES:END -->
