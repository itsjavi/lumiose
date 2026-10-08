---
id: TASK-3
title: Write the Lumen architecture specification
status: In Progress
assignee:
  - '@Lux'
created_date: '2026-10-08 09:59'
updated_date: '2026-10-08 10:34'
labels:
  - needs-review
  - needs-decision
milestone: m-0
dependencies:
  - TASK-1
  - TASK-2
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
type: docs
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Goal 1 for Lumen is a design: a TS 7-first web framework with first-class styles in TSX, setup-once components with signals, a Rust compiler, server-first islands with SPA opt-in, and agent-first DX. Accepted user choices: valid .tsx authoring; scoped CSS with reactive CSS variables plus global styles via an attribute on <style> (no :global everywhere); setup-once + signals; server-first islands + SPA. Implementation tasks will be derived from this spec, so it must be precise enough for workers to act on.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Spec doc covers goals/non-goals, package layout, component and reactivity API, styles model, compiler pipeline, rendering modes (CSR/SSR/SSG/islands/SPA), hydration protocol, routing/data scope, tooling and agent-first DX
- [x] #2 Includes a performance model explaining why Lumen should beat React and match Solid/Svelte/Vue Vapor on js-framework-benchmark and SSR throughput
- [x] #3 Each significant choice is recorded as an accepted or proposed decision record linked from the spec
- [x] #4 Lists risks and open questions that need user input
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Gather research (TASK-1, TASK-2).
2. Record the user-accepted choices as decisions 1-4.
3. Draft spec doc-1 covering every acceptance-criteria area.
4. Record proposed decisions 5-10 and link them from spec section 15.
5. Hand the spec to the user for review of the open questions in section 14 and the proposed decisions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec v0.1 is published as doc-1. Decisions 1-4 are accepted (user choices); decisions 5-10 are proposed and await user review. Decision bodies were filled by editing the decision files directly, because the Backlog CLI has no content option for decisions; the frontmatter was left untouched. Open questions for the user are in spec section 14: naming, data layer, signal read syntax, event naming, React island adapter.

User feedback (2026-10-08): the user rejects CSS inside JS tagged templates (css``); styles must be written as real CSS. Lux proposed a .lumen file format: TSX plus top-level raw-CSS <style> blocks, with masking so the TSX regions stay byte-identical; reactive values go through CSS custom properties set from JSX. This awaits user confirmation. Once confirmed, decision-1 and decision-2 need successor decisions and spec sections 0, 4.4, 4.5, 5 and 9 need revising.
<!-- SECTION:NOTES:END -->
