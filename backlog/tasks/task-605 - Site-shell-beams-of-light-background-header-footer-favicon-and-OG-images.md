---
id: TASK-605
title: 'Site shell: beams of light background, header, footer, favicon and OG images'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-11-17T12:28:00Z'
updated_date: '2026-11-17T16:30:00Z'
labels: []
milestone: m-16
dependencies:
  - TASK-604
references:
  - backlog/assets/redesign/b-first-light.html
ordinal: 597000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the LightField three.js island with the beams of the reference: thin amber lines and faint arcs fanning from the top-left corner, with no sun disc, drawn in SVG and animated in CSS. Update the document shell, favicon and OG images to the new identity.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Beams render without JavaScript, fade before they reach body text and are dimmer on inner pages than on the landing
- [x] #2 Measured in both themes at phone and desktop widths, text over the brightest point of a beam keeps at least 4.5:1
- [x] #3 The motion honours prefers-reduced-motion and keeps a pause control (decision-39)
- [x] #4 three.js and the LightField island are removed if nothing else uses them
- [x] #5 favicon.svg and the OG images use the Corner L mark and the new palette
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From TASK-602 (Lux): apps/web still hard-codes old brand colours in scripts/og-images.ts and public/favicon.svg.

Beacon (beacon-20261117-t605), paused on Lux's request, task stays In Progress.
Done and committed (c26d4dc3, 2f782328, 98e654bc, plus the wip spec commit): apps/web/src/components/Beams.stsx (static SVG beams and arcs, CSS pulse, dim level on inner pages, still under reduced motion, CSS-only 'Pause background animation' checkbox in the footer), wired in routes/layout.stsx; the LightField island and lib/light-field.ts are removed (the site never depended on three.js: the light field was hand-written WebGL, so no dependency or lockfile change); the landing's stage lost its night background, scrim and gradient headline so the beams show; favicon.svg and public/og/*.png in the Corner L identity (scripts/og-images.ts); screenshots backlog/assets/redesign/task-605-*.jpg.
Contrast, measured against the dev server with every beam at its peak (lowest ratio of text over a beam or arc pixel, 1440 and 390 px, landing, docs, /ui, benchmarks, playground): dark 4.91:1 (grey text, playground at 390 px; landing 5.06), light 5.18:1. Without beams the grey is 8.33 and 7.00.
Checks: lumiose check, vitest (46), pnpm typecheck and pnpm lint pass.
Left: the rewritten shell specs in e2e/web.e2e.ts and e2e/a11y.e2e.ts are committed as wip but were NEVER RUN (the e2e lock was held by another worker). No files are uncommitted.
Next step: take .local/coordination/e2e.lock, run 'pnpm exec playwright test --project=static e2e/web.e2e.ts e2e/a11y.e2e.ts' in apps/web, fix what fails in the shell specs, record the '[lowest contrast over a beam]' figures printed by the static build, then check off the acceptance criteria and write the final summary. Not verified: the favicon in a real browser tab, the paint cost of the pulse.

Beacon (beacon-20261117-verify): end-to-end verification on the static build (lumiose build, both base paths, served by e2e/serve.ts). web.e2e.ts 13 passed, 2 skipped (screenshot captures); a11y.e2e.ts 149 passed, 0 failed.
AC1: web.e2e 'the beams pulse behind every page, brighter on the landing' and 'without JavaScript the landing is complete, beams and their pause control included'. AC2: 'text over the beams keeps AA contrast at their brightest', lowest ratio per run: light 5.18:1 at 1440, 820 and 390 px; dark 5.14 (1440), 5.06 (820), 4.91 (390). The header's nav links over a beam pixel: light 6.95:1, dark 8.23:1 (7.00 and 8.33 without beams). AC3: 'under reduced motion the beams are still', 'reduced motion stops non-essential motion' and the pause check of 'no ambient motion runs longer than 5 seconds' on every page type. AC4: no LightField or light-field file or import is left in apps/web, and the site has no three.js dependency. AC5: public/favicon.svg and public/og/*.png inspected: Corner L, black and white with the amber quarter.
Fix (d95a610c): the flattened-layers test failed in the light theme, header links at 4.36:1. The beams were not the cause: the kit's header is 70% of the background (TASK-604 lowered it from 80%), so the grey links fall to 3.34:1 when black content, such as a primary button, scrolls under it. routes/layout.stsx now sets the header to 85% through class passthrough (4.96:1 light, about 6:1 dark), and the test flattens it to the same mix and no longer repaints .btn.primary, which is a solid fill. Follow-up for Halo: raise the default in packages/site-kit/src/SiteHeader.stsx to 85%, then drop the override.
The landing's '0 kB' no longer fails over the beams (lowest on the landing 5.06). For TASK-607: the FLATTENED stylesheet of a11y.e2e.ts still names the landing's .box, .closing, .install and tr.self glows; prune it with the rebuild, and re-run the beams contrast test, since the landing has the brighter beams.
Not verified: the favicon in a real browser tab, the paint cost of the pulse, and the playground wasm build (the wasm-bindgen CLI is 0.2.129, the workspace pins 0.2.130; the suites used the wasm built earlier).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The site shell draws the beams of decision-90 as a static SVG with a CSS pulse (components/Beams.stsx), dimmer on inner pages, still under reduced motion and paused by a no-JavaScript checkbox in the footer. The LightField island is gone, and the favicon and OG images use the Corner L mark. The header keeps 85% of the page background so its links hold 4.5:1 over anything behind it. Verified by web.e2e.ts (13 passed) and a11y.e2e.ts (149 passed) on the static build; text over a beam at its peak keeps at least 4.91:1 (dark, 390 px) and 5.18:1 (light).
<!-- SECTION:FINAL_SUMMARY:END -->
