---
id: TASK-4
title: Plan the Lumen implementation roadmap
status: In Progress
assignee:
  - '@Lux'
created_date: '2026-10-08 09:59'
updated_date: '2026-10-08 12:19'
labels: []
milestone: m-0
dependencies:
  - TASK-3
priority: medium
type: task
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Once spec v0.2 is reviewed, the work must be split into milestones and tasks that the roster (Photon, Spark, Beacon, Prism) can pick up independently, with clear ownership and dependencies.

The plan now includes first-class `.stsx` tooling (decision-11): a masking parser, shadow-TSX type checking with stock tsc, a language server that proxies the TS 7 native LSP, lint/format wrappers, and a VS Code grammar.

It also includes:
- the CSS compiler: placement-based scopes, `$name` constant folding, and class passthrough;
- async components: the `await` context rewrite, Suspense/ErrorBoundary, and hydration serialization;
- the package name `lumen`, with a pre-publish rename.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Implementation milestones exist with descriptions matching the spec's phases
- [ ] #2 Each milestone has assigned tasks with acceptance criteria and dependencies, without overlapping file ownership between concurrent workers
- [ ] #3 The first milestone delivers a measurable vertical slice (compiler + runtime running the js-framework-benchmark keyed suite)
- [ ] #4 Roadmap includes .stsx tooling (masking parser, shadow TSX + tsc, TS 7 LSP proxy, lint/format wrappers, VS Code grammar) as milestone work with owners
- [ ] #5 Includes a pre-publish naming task per decision-15
<!-- AC:END -->
