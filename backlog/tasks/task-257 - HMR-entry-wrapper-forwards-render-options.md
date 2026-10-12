---
id: TASK-257
title: HMR entry wrapper forwards render() options
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-12 19:57'
updated_date: '2026-10-12 20:26'
labels:
  - vite
  - dx
milestone: m-9
dependencies: []
priority: low
ordinal: 259000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The dev HMR wrapper of app entries (HMR_DOM_CODE in packages/vite/src/index.ts) defines render(code, container) and calls renderRoot(code, container), dropping render()'s third argument. Since TASK-247, render(code, container, { idPrefix }) prefixes useId() ids, so in lumiose dev the prefix is lost for entries that import render from lumiose/dom. Forward the options: render(code, container, options) -> renderRoot(code, container, options).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The HMR wrapper passes render()'s options through; a test covers idPrefix in a dev entry
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon: plan: forward render()'s third argument in HMR_DOM_CODE (packages/vite/src/index.ts); behavioral happy-dom test that runs the wrapper (from the plugin's load hook) against the real runtime and checks useId() under idPrefix. Docs do not mention the limitation, so no docs change.

Photon: done. HMR_DOM_CODE's render(code, container, ...rest) forwards every argument after the container to renderRoot (options today, any later ones too). Test: packages/vite/src/hmr-dom.dom.test.ts (happy-dom) loads the wrapper from the plugin's load hook, runs it against the real runtime and checks useId() under { idPrefix: 'cart-' } across a re-render (hot update) and without options. Mutation check: with the old call renderRoot(code, container) the test fails ('expected lc0 to match /^cart-lc\d+$/'). Docs: no page mentions the dev limitation, so none changed. Checks: pnpm check green (158 files passed, 1688 tests).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The dev HMR wrapper's render() now forwards render()'s options (and any later arguments) to the runtime, so idPrefix and useId() prefixes work in lumiose dev. Covered by packages/vite/src/hmr-dom.dom.test.ts; pnpm check green.
<!-- SECTION:FINAL_SUMMARY:END -->
