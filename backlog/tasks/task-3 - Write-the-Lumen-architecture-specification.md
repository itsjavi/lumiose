---
id: TASK-3
title: Write the Lumen architecture specification
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-08 09:59'
updated_date: '2026-10-08 12:18'
labels: []
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
Goal 1 for Lumen is a design: a TS 7-first web framework with first-class styles, setup-once components with signals, a Rust compiler, server-first islands with SPA opt-in, and agent-first DX.

Accepted user decisions:
- decision-3: setup-once components with signals.
- decision-4: server-first islands plus per-route SPA.
- decision-11: `.stsx` files (TSX plus raw CSS `<style>` blocks), with plain `.tsx` also allowed.
- decision-12: raw CSS with `$name` build-time constants and no reactive CSS.
- decision-13: async components on the server and the client, with Suspense and ErrorBoundary.
- decision-14: style scope follows placement (component, file, or global).
- decision-15: the package is named `lumen` until publishing.
- decision-16: backlog workflow; decisions are recorded only after user approval.

Decisions 5-10 are proposals awaiting user review. Spec v0.1 (doc-1) still describes the superseded `css` tagged-template design. Implementation tasks will be derived from this spec, so it must be precise enough for workers to act on.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Spec doc covers goals/non-goals, package layout, component and reactivity API, styles model, compiler pipeline, rendering modes (CSR/SSR/SSG/islands/SPA), hydration protocol, routing/data scope, tooling and agent-first DX
- [x] #2 Includes a performance model explaining why Lumen should beat React and match Solid/Svelte/Vue Vapor on js-framework-benchmark and SSR throughput
- [x] #3 User-approved choices are recorded as accepted decisions and linked from the spec; unapproved choices appear in the spec only as proposals
- [x] #4 Lists risks and open questions that need user input
- [x] #5 Spec v0.2 reflects decisions 11-16: .stsx/.tsx files, raw CSS <style> blocks scoped by placement, $name constants, no reactive CSS, async components with Suspense/ErrorBoundary, package name lumen
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Gather research (TASK-1, TASK-2).
2. Record the user-accepted choices as decisions 1-4.
3. Draft spec doc-1 covering every acceptance-criteria area.
4. Record proposed decisions 5-10 and link them from spec section 15.
5. Hand the spec to the user for review of the open questions in section 14 and the proposed decisions.

6. Rewrite the spec as v0.2 per decisions 11-16: remove the css tagged-template design; rename lumen-jsx to lumen; rewrite the styles, types, compiler and tooling sections (masking, shadow TSX + tsc, LSP proxy over TS 7 LSP, lint/format wrappers); add async components and Suspense.
7. Ask the user to review proposals 5-10 and the open questions in section 14; record only the decisions they approve.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec v0.1 is published as doc-1. Decisions 1-4 are accepted (user choices); decisions 5-10 are proposed and await user review. Decision bodies were filled by editing the decision files directly, because the Backlog CLI has no content option for decisions; the frontmatter was left untouched. Open questions for the user are in spec section 14: naming, data layer, signal read syntax, event naming, React island adapter.

User feedback (2026-10-08): the user rejects CSS inside JS tagged templates (css``); styles must be written as real CSS. Lux proposed a .lumen file format: TSX plus top-level raw-CSS <style> blocks, with masking so the TSX regions stay byte-identical; reactive values go through CSS custom properties set from JSX. This awaits user confirmation. Once confirmed, decision-1 and decision-2 need successor decisions and spec sections 0, 4.4, 4.5, 5 and 9 need revising.

User decisions (2026-10-08): .stsx extension plus plain .tsx (decision-11, supersedes decision-1); raw CSS blocks with build-time constants and no reactive CSS (decision-12, supersedes decision-2; interpolation syntax still pending); backlog is tracked in the main repo and is committed as part of the normal workflow (AGENTS.md updated). Still open: the constant syntax name and async client components. Spec v0.2 rewrite pending.

Decisions 14 (style scope by placement), 15 (package name lumen) and 16 (backlog workflow, approval rule) were recorded after explicit user approval. Proposed decisions 5, 6, 9 and 10 were aligned with 11-15: package renamed to lumen, the LUM4005 rule dropped, and the editor section amended.

Spec v0.3 is published as doc-1. User syntax choices recorded: count() reads, compiled .map/ternaries, onClick + on:click, client:* at the usage site. The user delegated all non-syntax decisions to Lux (decision-16 amended). Decisions 5-10 accepted; 17 (events), 18 (data loading) and 19 (SSR shell model) added. Prism's v0.2 review (blockers B1-B4, majors M1-M8, perf, sample-app gaps) is folded into v0.3.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Architecture spec v0.3 (doc-1) is the implementation baseline: .stsx authoring with placement-scoped raw CSS and $name constants, setup-once signals, async components with Suspense, a Rust/OXC compiler, server-first islands with per-route SPA and a shell-first SSR model, plus tooling, agent DX and the performance model. Decisions 3-19 are accepted. Verified by an independent Prism review (with TS 7.0.2 experiments) whose findings are incorporated.
<!-- SECTION:FINAL_SUMMARY:END -->
