---
id: TASK-614
title: '/ui: a gallery of every component, live, and the component page layout'
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-11-17T12:29:00Z'
updated_date: '2026-11-17T14:27:00Z'
labels: []
milestone: m-16
dependencies:
  - TASK-604
  - TASK-613
references:
  - backlog/assets/redesign/b-first-light.html
ordinal: 606000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rebuild the /ui section to the reference: the index is a grid of every @lumiose/ui component as a live demo, each cell linking to its page; a component page shows a large preview, usage and a props table.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The index lists every component exported by @lumiose/ui, generated from the package so new components appear without hand edits
- [ ] #2 Each demo on the index is interactive and each cell links to its component page
- [ ] #3 A component page shows the preview first, then usage beside the props table
- [ ] #4 ui docs:check and the ui e2e and a11y suites pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Paused on the orchestrator's request (session beacon-20261117-t614), resumable.
Done: /ui is the gallery (UiGallery: one cell per page of the llms.txt Components section, running the page's first live demo, footer links to the page; the README follows the grid, so /ui anchors keep working; the index has no docs shell). Component pages (UiComponentPage) show the preview, then usage (import block plus Anatomy snippet) beside the props (first table of the API section), then the page as written; guides stay on DocArticle. Rules live in apps/web/src/content/ui-gallery.ts with ui-gallery.test.ts; no new Markdown syntax. Commits f9fe504a and 42ecc27d, plus a wip commit with e2e/ui.e2e.ts and the screenshots.
Verified: lumiose check, web vitest (53), pnpm typecheck, pnpm lint, ui docs:check. First e2e run (build of 14:57): ui.e2e.ts passed except the component-page test (a locator, since fixed, not rerun); every 'axe: UI' page and open-demo test passed in both themes, rerun on a fresh build too (113 passed before the stop).
Left: rerun e2e/ui.e2e.ts (the fixed component-page test, and SCREENSHOTS=1 to retake task-614-tabs-*.jpg at viewport size: the committed ones are full-page) and the a11y reflow, pointer-target and keyboard-focus tests. In the first run those stopped at pages outside this task (/ui/installation overflow at 320 px via DocArticle, /docs/concepts/styles sidebar targets, header contrast in the flattened-layers test); a manual check of all 43 /ui pages on the dev server found no reflow overflow and one small target, fixed in 42ecc27d.
Notes: Playwright's static webServer fails at scripts/playground-assets.ts (wasm-bindgen cannot read the wasm): build both variants by hand and start e2e/serve.ts on 5194 first. Commit 42ecc27d also carries another worker's pending edits to apps/web/CONTRIBUTING.md (the beams and motion paragraphs of TASK-605), swept in by the pathspec commit. UiProse duplicates DocArticle's prose styles: share them once TASK-608 lands.
Next step: take e2e.lock, build, serve, run 'playwright test e2e/ui.e2e.ts e2e/a11y.e2e.ts --project static' with SCREENSHOTS=1, then check off the criteria and set Done.
<!-- SECTION:NOTES:END -->
