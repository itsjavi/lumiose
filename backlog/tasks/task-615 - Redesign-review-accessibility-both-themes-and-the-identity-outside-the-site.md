---
id: TASK-615
title: 'Redesign review: accessibility, both themes, and the identity outside the site'
status: In Progress
assignee:
  - '@Lux'
created_date: '2026-11-17T12:29:00Z'
updated_date: '2026-11-17T17:34:00Z'
labels: []
milestone: m-16
dependencies:
  - TASK-607
  - TASK-610
  - TASK-611
  - TASK-612
  - TASK-614
  - TASK-603
  - TASK-616
references:
  - backlog/assets/redesign/b-first-light.html
ordinal: 607000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Final pass of the redesign: review every page type in both themes at phone and desktop widths, run the a11y suites, and carry the identity to places outside the site (README, the VS Code extension icon, create templates, the npm package pages).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The a11y e2e suites pass and a contrast scan of the built site finds no text below 4.5:1
- [x] #2 README, the VS Code extension icon and the create templates use the Corner L mark, or the mark chosen after the logo check
- [x] #3 Final screenshots of the landing, a docs page and /ui in both themes are in backlog/assets and linked here
- [ ] #4 The user signs off before the next release
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (beacon-20261117-t615) takes the hands-on part, delegated by Lux.

Beacon (beacon-20261117-t615), review pass.

Old look. Source scan of apps/web/src, packages/site-kit/src and its showcase: no old brand colour, no text shadow, no glow; radius and shadow tokens are all zero. Rendered scan (static build, 19 routes: landing, docs getting started, a concept, a reference and an error page, /ui and four of its pages, /benchmarks and both sub-pages, /showcase, /playground, /stsx and a sub-page, /examples, not-found; both themes, 1280 px), computed styles, before → after: gradients 8 → 8, box shadows 6 → 6, radii 60 → 60, backdrop blur 38 → 38, off-palette colours 50 → 0 (the amber skip link on every page, and browser-blue links in six /ui gallery demos). What stays, and why: the dotted sheet behind a component preview (radial-gradient dots, in the agreed dummy; 6), the indeterminate Progress fill of @lumiose/ui (2), the inset rules under the selected tab and the pressed toggle of @lumiose/ui demos (6) and under the current docs step (in the dummy), the round dots that mark the active navigation item and the radio buttons of the demos (60), the header blur (in the dummy; 38), the theme palette swatches, the amber bars and marker of the Lumiose row on /benchmarks (TASK-606), syntax colours (user, 2026-11-17), the playground error colour, the indigo and amber avatar images of the Avatar demos (packages/ui/docs samples), and CodeMirror own button gradient, which no enabled panel shows. Not scanned: the mounted showcase apps. The gradients the user saw are most likely the dev inspector mark (TASK-617) or the deployed site, which is behind the local branch.

Changes: site-kit SiteHeader keeps 85% of the page background (was 70%) and apps/web drops its override; the skip link is inverted text instead of amber; the docs search field uses the shared focus ring instead of an amber border with a soft halo; plain links in UI previews take the text colour; the gallery arrow no longer turns amber on hover.

Identity outside the site: README.md and packages/lumiose/README.md (logo alt text; the sample accent is amber with black text); packages/vscode/icon.png is the Corner L on black, 256 px, rendered from the SVG with the Playwright Chromium the OG images use; the static create template link colour is no longer indigo. Nothing else carried the old logo: the templates have no favicon, site-kit has no image assets, the docs have no images, and the READMEs have no badges. Left alone: sample colours in docs and examples that are user code (#5546ff in concepts/styles.md, #2563eb in the UI theming and styling samples, #4f46e5 in LUM3009 and examples/vite-counter). The mark is still subject to the manual logo checks of TASK-616.

Verification (static build of both base paths by lumiose build, served by e2e/serve.ts): pnpm typecheck and pnpm lint pass; vitest 3012 passed, 2 skipped; lumiose and @lumiose/ui docs:check pass; site-kit showcase Playwright 22 passed, 8 skipped (captures); apps/web: web 16 passed, 2 skipped; docs 4; ui 11 passed, 1 skipped; redirects 19; playground 5 passed, 1 skipped; a11y 147 passed, 0 failed; showcase.dev 4 passed (lumiose dev on port 5197). Contrast: axe finds no text below 4.5:1 on any page type in either theme, flattened layers included; lowest text over a beam at its peak 4.91:1 (dark, 390 px; 5.21 at 1440 px) and 5.18:1 (light); lowest syntax colour on the code background 5.34:1 (comment, light; dark 6.38).

Not verified: the playground wasm build (wasm-bindgen CLI 0.2.129, the workspace pins 0.2.130; the suites used the wasm built earlier), the mounted showcase apps, the extension icon inside the Marketplace and VS Code, hover and open states in the rendered scan (the a11y suite opens the UI demos), cargo test.

Screenshots: backlog/assets/redesign/final-landing-dark.jpg, final-landing-light.jpg, final-docs-dark.jpg, final-docs-light.jpg, final-ui-dark.jpg, final-ui-light.jpg, final-benchmarks-dark.jpg.

Lux, 2026-11-17: every other M16 task is Done (602 to 614, 617). Added after planning, at the user request: syntax colours restored in code (decision-90 amended), the dev tools restyled (TASK-617), icon glyphs of the UI theme written as CSS escapes. Open: AC #4 (the user signs off; nothing is pushed) and TASK-616 (manual logo checks). Open questions for the user are R1 to R6 in doc-10; one more from the review: the amber bars and row marker on /benchmarks are outside the accent list of decision-90 and were left.
<!-- SECTION:NOTES:END -->
