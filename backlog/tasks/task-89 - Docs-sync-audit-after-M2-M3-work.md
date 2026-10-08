---
id: TASK-89
title: Docs sync audit after M2/M3 work
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-08 21:02'
updated_date: '2026-10-08 21:17'
labels: []
milestone: m-5
dependencies:
  - TASK-80
priority: high
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Several features landed after the docs were written (TASK-32), and the user noticed a feature commit without docs (TASK-79). Audit the docs against the implemented features and fix every gap, so docs reflect the current state.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every feature committed since TASK-32 is documented accurately: decision-23 subtree scoping (done by Lux in 3dc3242, verify), hydration and the island loader (TASK-18, see TASK-87), lumen dev/build/preview and adapter-node (TASK-24/26), form actions/submit/fetchJSON/busy (TASK-23/44, decision-20), the CLI JSON envelope, typegen and routes (TASK-28), lumen({ mode, ssr, … }) (TASK-77, decision-21), the CSS diagnostics LUM3017–3019 (TASK-76/67), and the compiler meta changes
- [x] #2 Status notes that say 'not yet' are removed or updated; docs:check and the docs tests pass; llms files regenerated
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inventory: grep docs for status notes ('not yet', 'Status:', 'Planned', TASK ids) and list features since TASK-32.
2. Per feature, compare the docs with the code and tests: decision-23 (verify 3dc3242), hydration/island loader (with TASK-87), lumen dev/build/preview + adapter-node, form actions/submit/fetchJSON/busy (decision-20), CLI JSON envelope/typegen/routes, lumen({ mode, ssr, trailingSlash, csrf }), LUM3017–3019, compiler meta (scopeTokens subtree scopes).
3. Fix gaps in packages/lumen/docs (concepts, reference, errors), regenerate llms, run docs:check and docs tests; commit per area.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon audit (commit 0059f43, plus 25458c7/82ac528 for the editor and 3dc3242 verified):
- decision-23: styles.md (Lux, 3dc3242) verified; added the editor note (TASK-80).
- Hydration/loader: see TASK-87 (dom.md, islands.md, LUM4006).
- lumen dev/build/preview + adapter-node: cli.md and rendering-modes.md were accurate; added reference/adapter-node.md (createServer/createHandler/createStaticHandler, caching, trailingSlash, origin) and indexed it; status notes in routing.md/server.md/rendering-modes.md updated (served by dev/build/preview; SPA mode + router still in progress, TASK-25).
- Actions/submit/fetchJSON/busy (decision-20): data-and-actions.md, app.md, async.md, reactivity.md match the exports and semantics; no change.
- CLI envelope/typegen/routes (TASK-28): cli.md matches main.ts; 'Planned commands' wording fixed; agents init in the index.
- lumen({ mode, ssr, trailingSlash, csrf }) (TASK-77): vite.md already documents them (validation, api.options); rendering-modes.md uses lumen({ mode }).
- LUM3017–3019: see TASK-82 (styles.md).
- Compiler meta (scopeTokens → SubtreeScope[]): internal (@lumen/compiler, doc-2), not part of the user docs; no user page referenced it.
- Remaining 'planned' notes are accurate: LUM2007, LUM3012, LUM4004, LUM4008 not reported; LUM4003 build-time graph check planned (now also said in islands.md); lumen/router, @lumen/testing, lumen mcp/upgrade.
Checks: gen-error-docs --check clean, llms regenerated, docs tests 16/16 (contract, links, examples).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The docs match the implemented features: hydration and the island loader, @lumen/adapter-node (new reference page), CSS value warnings LUM3017–3019, editor features, and status notes updated (dev/build/preview available; SPA router still in progress).
<!-- SECTION:FINAL_SUMMARY:END -->
