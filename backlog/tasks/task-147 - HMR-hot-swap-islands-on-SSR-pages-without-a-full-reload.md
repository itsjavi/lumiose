---
id: TASK-147
title: 'HMR: hot-swap islands on SSR pages without a full reload'
status: Done
assignee:
  - Spark
created_date: '2026-10-09 05:24'
updated_date: '2026-10-09 12:32'
labels:
  - dev
  - hmr
dependencies:
  - TASK-146
priority: low
ordinal: 147000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planned only (user 2026-10-09: 'plan only') — do not start without the user's go-ahead. When an edit only changes island code (the server graph change is the island module itself), re-render the affected island instances in the browser from their serialized props instead of reloading the page; server-rendered content, other islands and scroll position stay.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Editing an island's code updates its instances in place on server and static pages; other islands keep state; server-only edits still reload
- [x] #2 Playwright test in islands-e2e for both cases
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User 2026-10-09: approved.

Spark: island-level hot swap, independent of TASK-146's component registry. lumen dev (app/dev/plugin.ts) appends an import.meta.hot.accept handler to island modules in the client environment (island refs from the plugin's islandModules()); the handler calls the loaders registered under globalThis[Symbol.for('lumen.hot')] (lumen/dom islands.ts, DEV only, 0 bytes in production), which dispose each hydrated instance of the module, clear its range and render it again with the new export from its serialized props, awaits and slot sources (hydrate.ts keeps them on the start comment in DEV). If no instance swapped, an export is missing, or the module has client importers other than the island manifest, it falls back to a reload (hot.invalidate / the ssr hotUpdate reload). The ssr hotUpdate skips its reload only for such island modules; other server-rendered edits reload as before. Test: examples/ssr-bookshelf/e2e/hmr.dev.ts in a new 'dev' Playwright project on lumen dev (islands-e2e runs its own Vite middleware server without lumen dev, so the test lives in the bookshelf): editing AccountMenu re-renders it with no reload while the SearchBox keeps its typed value; editing Header.stsx reloads. Note for Photon/TASK-146: when the component registry lands, the island handler can delegate to it (swap component instances inside the island instead of re-rendering the island); the hook is the HotSwap list in dom/islands.ts. Validation: lumen typecheck/oxlint, app/dev + dom vitest 163/163, bookshelf Playwright 16/16 (dev test 3 runs green). Docs: reference/cli.md lumen dev.
<!-- SECTION:NOTES:END -->
