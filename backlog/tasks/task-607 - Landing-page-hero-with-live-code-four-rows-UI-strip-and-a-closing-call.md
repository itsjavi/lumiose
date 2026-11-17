---
id: TASK-607
title: 'Landing page: hero with live code, four rows, UI strip and a closing call'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-11-17T12:29:00Z'
updated_date: '2026-11-17T17:13:00Z'
labels: []
milestone: m-16
dependencies:
  - TASK-605
  - TASK-606
references:
  - backlog/assets/redesign/b-first-light.html
ordinal: 599000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rebuild the landing to the reference: a left-aligned hero beside one live code example, four numbered rows (Write, Render, Hydrate, Measure) with one sentence and one link each, a strip of live @lumiose/ui components, and a closing install box. Everything else lives one click deeper.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The landing has only the sections of the reference; the stack table is on /benchmarks and the Measure row links to it
- [x] #2 The code sample and its compiled output still come from this version of the compiler (content/samples.ts) and no number is hand-written
- [x] #3 The hero counter is a real island and works without the playground bundle
- [x] #4 Page meta, tagline and descriptor of decision-37 are unchanged
- [x] #5 Screenshots of both themes at phone and desktop widths are in backlog/assets and linked here
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (session beacon-20261117-t607) started. Contract (user, 2026-11-17): the landing matches the homepage of the click dummy element by element, keeps the site's own hero copy, has no gradients, no benchmark figures and no live editor (the Playground island); the counter and the UI tray render on the server at their final size.

Built to the dummy's homepage (.hero, .rows, .strip, .end), with the site's hero copy: label 'Static sites · Server-side rendering · Islands · SPAs', headline 'One component model, / from static pages to full-stack apps' (second line grey), lead shortened to two lines: 'Write components in TSX with their styles in the same file. Each route picks how it renders, with no rewrite.' Rows link to concepts/components, concepts/rendering-modes, concepts/islands and /benchmarks. The tray uses Switch, Tabs, Slider and Button from @lumiose/ui (per-component imports, default theme), as server HTML.

AC2: the code panel shows the source of islands/Counter.stsx (content/samples.ts reads the file as text), so what runs under the code is what this compiler builds from it; content.test.ts compiles it and checks the emphasis. The landing shows no compiled output and no number.

Removed: stack table, bar chart, proof numbers, the four boxes, rendering-mode cards, the pre-release badge, the static tabs, every gradient, and the Playground island (user: no live editor on the homepage). Deleted as unused: the Playground's embedded mode, content/release.ts, counterOutput, counterCss, checkText, the landing-demo tests of playground.e2e.ts.

Deliberate deviations from the dummy (user, 2026-11-17): the hero columns align from the top, and the hero's top padding is about 70px on desktop (40px on phones) instead of 120px. Also: the headline is 66px at 1280 (the dummy's 84px would put the longer real copy on six lines); the hero's label is the text colour and its grey line and lead a stronger grey (#bfbfbf dark, #3e3e3e light), which the contrast over the beams needs; a file name in the code bar keeps its case; the secondary button border is site-kit's 3:1 grey.

Checks on the static build (lumiose build served by e2e/serve.ts): web.e2e.ts 16 passed, 2 skipped (captures); playground.e2e.ts 5 passed, 1 skipped; a11y.e2e.ts 147 passed. New: 'the landing loads no playground or editor code' (no request matches playground, codemirror, lezer, wasm or editor; /playground does), and 'nothing on the landing shifts after the first paint' at 1280 and 390 px (cumulative layout shift 0 after load and after scrolling to the bottom; the measure reports a shift when a block is inserted). Lowest contrast of text over a beam at its brightest, on the pages the a11y spec measures, landing included: light 5.18:1 at 1440, 820 and 390 px; dark 5.21:1 at 1440 and 820 px, 4.91:1 at 390 px. lumiose check clean; vitest 56 passed; pnpm typecheck and pnpm lint pass; oxfmt clean.

Screenshots: backlog/assets/redesign/task-607-landing-desktop-dark.jpg, task-607-landing-desktop-light.jpg, task-607-landing-phone-dark.jpg, task-607-landing-phone-light.jpg.

Not verified: browsers other than Chromium; widths between the measured ones for the contrast over the beams; the og:image still describes '0 kB of JavaScript' (shell, TASK-605). Commits: 293c5d62, 197f9093, 79d9356d.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The landing is the redesign's homepage: a top-aligned hero with the site's copy beside a static, highlighted Counter.stsx panel whose counter runs under it as a small island; four numbered link rows; a strip with four live @lumiose/ui components; a closing box with the install command. No benchmarks, gradients or live editor remain on it, and it has no layout shift (tested).
<!-- SECTION:FINAL_SUMMARY:END -->
