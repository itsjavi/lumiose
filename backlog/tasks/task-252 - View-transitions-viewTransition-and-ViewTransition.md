---
id: TASK-252
title: 'View transitions: viewTransition() and <ViewTransition>'
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-12 18:40'
updated_date: '2026-10-12 20:11'
labels:
  - runtime
  - api
  - router
milestone: m-9
dependencies:
  - TASK-247
priority: medium
ordinal: 254000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-43. viewTransition(fn) runs an update inside document.startViewTransition with flush(), falling back without support or with reduced motion; the SPA router uses it for navigations. <ViewTransition name? enter? exit?> names its single child (useId() by default) and applies enter/exit classes so conditionals and lists animate. Opt-in imports, tree-shaken.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 viewTransition() works with signals (DOM updated inside the transition) and falls back cleanly
- [x] #2 <ViewTransition> animates enter, exit and moves of conditionals and keyed lists; SPA navigations use viewTransition()
- [x] #3 Runtime size stays under the cap when unused; docs and tests (happy-dom + a browser check)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: SPA navigations use viewTransition() only when the existing lumiose({ viewTransitions: true }) option is on.

Spark 2026-10-12: started (TASK-247 done in 94e8629). Lux: export viewTransition and <ViewTransition> from lumiose (no new subpath), in their own source module excluded from the capped core+dom measurement and reported on its own line; Spark may edit packages/vite/src/app/router/entry.ts (~5 lines) for the SPA flag.

Spark 2026-10-12, implementation (code in 9417918):
- dom/view-transition.ts (exported from lumiose via src/index.ts, outside dom/public.ts; server variant server/view-transition.ts via index.server.ts): viewTransition(fn) runs fn + flush() inside document.startViewTransition and resolves with transition.finished (rejects when fn throws); without support or with prefers-reduced-motion it runs fn + flush() at once.
- <ViewTransition name? enter? exit?>: sets the single child element's view-transition-name (useId() unless name) and registers it. Enter/exit classes: exits must carry their class when the browser captures the old state, before the update says what goes, so viewTransition() gives every connected instance with exit its exit class first and removes it from those still connected after the update (moves); elements connected by the update get the enter class until finished. Chromium confirms the new element's class wins for moves (e2e). A non-element child renders unnamed with a dev warning. Server: renders the child as is, taking the default name's useId() so later ids stay in step with hydration (no name in server HTML; MPA cross-document names stay CSS).
- SPA router: SpaConfig.viewTransition; a navigation that changes levels swaps inside it (a same-levels query change commits at once); a swap requested once per navigation, dropped when superseded. The SPA entry (packages/vite/src/app/router/entry.ts, spaEntryCode options object { csr, viewTransitions }) imports viewTransition() only with lumiose({ viewTransitions: true }); dev passes the option (dev/plugin.ts, Lux-approved one-liner); builds read it from the lumiose plugin's api.options.
- Size: view transitions are reported on their own line (scripts/size.ts: every export + view transitions, report-only): +0.30 kB brotli on top of every export (9.89 -> 10.20 kB); typical imports + view transitions 6.60 kB. The capped every-export entry stays 9.89 kB.

Spark 2026-10-12, evidence: dom/view-transition.test.ts 8/8 (fallback without support, reduced motion, DOM old before / new after the update, rejections, default and explicit names, non-element child warning, conditional enter/exit classes, keyed list enter/exit/move with stable names, no classes outside viewTransition()); app/router/view-transition.test.ts 3/3 (page swap inside the transition, query change at once, superseded swap dropped); dom/id.test.ts ViewTransition hydration parity case; packages/vite entry.test.ts (codegen with and without the option, csr and hydrating entries). Browser (examples/islands-e2e, new Notes island + e2e/view-transitions.e2e.ts, Chromium): useId() ids survive hydration; enter (::view-transition-new(note-panel) vt-in), exit (::view-transition-old(note-panel) vt-out), keyed list (old row vt-out, new row vt-in, moved rows only the UA group animation, names kept); reduced motion: no startViewTransition, DOM updated. islands-e2e 8/8. Not browser-checked: SPA navigations with viewTransitions: true (spa-router-e2e does not enable the option; covered by happy-dom + codegen tests). pnpm typecheck OK, oxlint OK, docs:check and cli docs tests 17/17, size OK. pnpm test: 1 failure outside this task (vite options.test 'Known options' list, the adapter option of TASK-175 in progress). spa-router-e2e 25/26: the [build] prefetch test expects a chunk named 'slow', which TASK-253's renames turned into 'page' (not this task).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
viewTransition(fn) and <ViewTransition name? enter? exit?> exported from lumiose (opt-in module, outside the capped runtime; +0.30 kB brotli when used). Updates flush inside document.startViewTransition, with a plain fallback without support or under reduced motion; named children morph when they move and get enter/exit view transition classes, verified in Chromium. With lumiose({ viewTransitions: true }) SPA navigations to another page swap inside viewTransition() (the SPA entry imports it only then). Docs: reference/components (both APIs, example), reference/vite, concepts/routing, concepts/components, coming-from-react.
<!-- SECTION:FINAL_SUMMARY:END -->
