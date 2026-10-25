---
id: TASK-576
title: 'lumiose() scopedStyles option, with docs'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-25 00:31'
labels:
  - build
  - css
  - docs
milestone: m-14
dependencies:
  - TASK-573
  - TASK-574
references:
  - >-
    backlog/decisions/decision-85 -
    Scoped-styles-attribute-or-class-strategy-specificity-and-namespace-scopedStyles.md
  - packages/vite/src/options.ts
  - packages/vite/src/styles.ts
  - packages/lumiose/docs/concepts/styles.md
priority: medium
ordinal: 568000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implements decision-85 in the Lumiose Vite plugin.
- `lumiose({ scopedStyles: { strategy, specificity, namespace } })` is validated at startup, using lumiose_css's namespace validator.
- It is passed to every compile: client, server, the project scan, the CSS manifest and HMR.
- The default output becomes `data-lum-<hash>`. Update tests, snapshots, examples, benchmarks and e2e assertions that hard-code `data-l-<hash>`. Ask the owners of those areas, or the orchestrator, before editing outside packages/vite.
- Docs in the same task: the styles concept page (strategies, specificity default vs zero, namespace, passthrough) and the plugin options reference, regenerated with docs:gen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumiose({ scopedStyles }) validates its values at startup with a clear error and applies them in dev, build and prerender
- [ ] #2 Every strategy and specificity combination renders correctly in an example app in dev and production, including :deep() and class passthrough
- [ ] #3 Tests, snapshots and e2e assertions that hard-coded data-l-<hash> use the configured names; pnpm check passes
- [ ] #4 The styles concept page and the plugin options reference document scopedStyles; docs:check passes
<!-- AC:END -->
