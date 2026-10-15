---
id: TASK-341
title: In-page dev inspector
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-15 07:41'
updated_date: '2026-10-15 09:02'
labels:
  - dx
milestone: m-11
dependencies:
  - TASK-323
priority: low
ordinal: 343000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implements decision-59 (proposal in TASK-323, approved by the user on 2026-10-15). A dev-only inspector that lumiose dev injects in a shadow root: Tree (owners, a props snapshot, source locations), Signals (values, dependents, the last write), Islands (strategy, state, timings, and the load failures of TASK-305), Why did this update, and Alt+click to open the element's .stsx source through Vite's open-in-editor endpoint. Alt+Shift+L or a corner button opens it; lumiose({ inspector: false }) turns it off. The reactive core and the island loader call a dev hook registry only behind DEV, and the compiler passes component names and source locations in dev. The injection lives in Nova's packages/vite/src/app: coordinate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Alt+Shift+L or the corner button opens the inspector in dev, and lumiose({ inspector: false }) removes it
- [x] #2 Tree, Signals, Islands and Why did this update show the page's live state
- [x] #3 Alt+click opens the element's .stsx source at its line
- [x] #4 Builds contain none of it: bundles and size caps are unchanged
- [x] #5 The docs describe it (a dev tools section and reference/vite.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (session spark-20261015T-m11, worktree branch claude/spark-m11-d34fd0) started 2026-10-15.

Implementation (Spark, 2026-10-15):
- Registry: packages/lumiose/src/dom/devtools.ts, a leaf module (core/owner.ts hands it its owner tools through inspectOwners(), so owner.ts can report while it initializes). Hooks in core (owner.ts attachOwner, reactive.ts writeSignal/trigger, signal.ts, effect.ts effect/renderEffect/runUser/runRender, store.ts), dom (component.ts createComponent, islands.ts every loader step including TASK-305's failure path, hot.ts), plus internal labels for runtime-made signals (core/async.ts, optimistic.ts, dom/boundaries.ts, list.ts, public.ts ref/Dynamic, app/router). Readers find it at globalThis[Symbol.for("lumiose.devtools")] (version 1, internal shape), so a browser extension could reuse it.
- Guard: every call is `if (import.meta.env?.DEV && INSPECTED)`, INSPECTED (dom/dev.ts) = DEV && import.meta.env.LUMIOSE_INSPECTOR. Decision: INSPECTED alone was folded only after Rolldown split chunks; in ssr-bookshelf, ref() sat in an island chunk and made the loader chunk export aliasValue, which kept the registry in the build. The define-replaced operand first drops the call before chunking.
- Compiler (Photon's area, allowed by the brief): CompileOptions::dev_source (napi/wasm devSource): data-lumiose-source="<file>:<line>:<column>" on every intrinsic element in client templates and server HTML, $hot(..., source) component locations, and $label(signal()/computed()/ref(), "name") from lumiose/dom/hot. Off by default.
- Vite: lumiose({ inspector }) (options.ts and index.ts are Photon's area; ProjectOptions and INSPECTOR_DEFINE in Nova's app/project.ts). The dev plugin sets the define unless inspector: false; the compiler plugin turns devSource on when the define is present (serve, not under Vitest, not for content modules). The dev client module mounts packages/vite/src/app/dev/inspector.ts with { root, base }.
- UI: <lumiose-inspector> appended to <html> (outside <body>, so the server-update morph leaves it alone), closed shadow root (Playwright locators skip closed roots, so app e2e suites never see it), constructed stylesheet plus CSSOM (allowed by lumiose({ csp: "strict" })), Alt+click on a window capture listener (before the island loader's document listeners), open state per tab in sessionStorage.

Names for the user's review: data-lumiose-source (dev-only attribute, after Astro's data-astro-source-file/-loc, as one file:line:column value); the docs page concepts/dev-tools.md ("Dev tools"); SpaRoot (Tree's name for the SPA root island); internal: the compile option devSource/dev_source, lumiose/dom/hot's $label, the registry key Symbol.for("lumiose.devtools"). Shortcut, option and panel names as approved in decision-59. No new diagnostics.

Evidence:
- pnpm --filter lumiose size: byte-identical to main, every line (core + dom + islands 9.22 kB, whole client runtime 13.32 kB).
- Builds against main's runtime (same compiler binding, devSource is off in builds), diff -r of dist: spa-router-e2e (56 files), ssr-bookshelf (127), ssg-travel-journal (157), ssg-spa-e2e (31), spa-dotmatrix (134), spa-chiptune (105), ssr-styles-e2e (30) byte-identical; apps/web: JS identical, only docs HTML and search.json differ (the new page).
- Tests: lumiose src/dom/devtools.test.ts (10), vite inspector.dom.test.ts (8), inspector-format.test.ts (4), dev-server.test.ts (+2: mounted by default, gone with inspector: false), options.test.ts (+1), compile_api dev_source test, dev_source.rs unit tests.
- Browser (lumiose dev): ssr-bookshelf (strict CSP, server pages plus a SearchBox island) and spa-router-e2e (SPA tree): Tree, Signals, Islands, Why did this update, Select, Alt+click (fetch stubbed: page.stsx:38:11 for the clicked link) and the Alt outline. Screenshots: backlog/assets/task-341-tree.png, task-341-signals.png, task-341-islands.png, task-341-why.png, task-341-alt-source.png.

Limitations (documented in concepts/dev-tools.md): Tree lists what runs in the browser (islands, spa pages), server-only components only through Alt+click; a write's location names the file and function, not the line (stacks have compiled positions); effects have no labels (effect #N).

Checks (2026-10-15): pnpm check green (1949 Vitest tests, cargo tests, size, docs); cargo fmt --all --check and cargo clippy --workspace --all-targets -D warnings clean. Playwright, all projects: spa-router-e2e 38, ssr-bookshelf 17, ssr-styles-e2e 10, ssg-spa-e2e 19 (1 skipped), spa-dotmatrix 66, spa-chiptune 28, ssr-realtime 9 (1 skipped), apps/web 66 (3 skipped). Dev pages now carry data-lumiose-source, so three raw-HTML assertions of the dev projects allow extra attributes (spa-router-e2e, and ssg-spa-e2e in Nova's area); head elements (<title>, <meta>, …) get no attribute, since the runtime keeps the HTML of <title> defaults.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
In-page dev inspector (decision-59). lumiose dev mounts it from its dev client in a closed shadow root: Alt+Shift+L or the corner button opens Tree (components with props, source and island), Signals (values, dependents, last write; Lumiose's own on demand), Islands (strategy, state, armed/load/hydrate timings, failures from the loader's TASK-305 path) and Why did this update (the writes, through computeds, that re-ran a selected element's bindings, plus the latest updates); Select picks an element; Alt+click opens any element's source, server-rendered markup included, through Vite's open-in-editor endpoint. lumiose({ inspector: false }) removes all of it.

The runtime reports to a dev hook registry (lumiose src/dom/devtools.ts) behind `import.meta.env?.DEV && INSPECTED`; the compiler's devSource option adds data-lumiose-source attributes, component locations and signal labels in dev only. Builds are unchanged: the size report is byte-identical to main, and seven example builds (683 files) are byte-identical to main's. Docs: concepts/dev-tools.md, reference/vite.md, reference/cli.md, coming-from/react.md. Screenshots: backlog/assets/task-341-*.png.
<!-- SECTION:FINAL_SUMMARY:END -->
