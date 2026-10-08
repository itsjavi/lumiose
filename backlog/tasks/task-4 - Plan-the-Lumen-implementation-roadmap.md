---
id: TASK-4
title: Plan the Lumen implementation roadmap
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-08 09:59'
updated_date: '2026-10-08 12:21'
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
- [x] #1 Implementation milestones exist with descriptions matching the spec's phases
- [x] #2 Each milestone has assigned tasks with acceptance criteria and dependencies, without overlapping file ownership between concurrent workers
- [x] #3 The first milestone delivers a measurable vertical slice (compiler + runtime running the js-framework-benchmark keyed suite)
- [x] #4 Roadmap includes .stsx tooling (masking parser, shadow TSX + tsc, TS 7 LSP proxy, lint/format wrappers, VS Code grammar) as milestone work with owners
- [x] #5 Includes a pre-publish naming task per decision-15
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create milestones M1-M7 that follow the spec phases.
2. Create tasks with owners, acceptance criteria and dependencies, ordered so that the three sample apps work end-to-end first.
3. Assign file ownership per agent so concurrent workers never overlap.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
File ownership for concurrent work. Shared files (root configs, pnpm-lock.yaml, packages/lumen/package.json) are owned by Lux; workers take .local/coordination/pnpm.lock before changing dependencies or running pnpm install.
- Lux: root configs, the contract doc and stubs, examples/ssg-*
- Photon: crates/**, packages/lumen/src/vite/**
- Spark: packages/lumen/src/{core,dom,server}/**, packages/lumen/src/index.ts (public runtime exports), benchmarks/**, examples/spa-*
- Nova: packages/lumen/src/app/**, packages/adapter-node/**, examples/ssr-*
- Beacon: packages/lumen/src/{cli,jsx}/**, packages/lumen/docs/**, packages/{language-server,vscode,create,testing,eslint-plugin,prettier-plugin}/**
Roster: Nova (app layer) added to agents.json.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The roadmap is in place. Milestones m-1 to m-7 hold TASK-5 to TASK-41, each with acceptance criteria, dependencies and an owner from the roster (Lux, Photon, Spark, Nova, Beacon, Prism) under the file-ownership map in the notes. M1 ends with a measured js-framework-benchmark vertical slice (TASK-12). M4 covers .stsx tooling (TASK-27 to TASK-31). M6 holds the three sample apps (TASK-35 to TASK-37), and M7 the naming task (TASK-39). backlog doctor reports no cycles.
<!-- SECTION:FINAL_SUMMARY:END -->
