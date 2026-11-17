---
id: TASK-605
title: 'Site shell: beams of light background, header, footer, favicon and OG images'
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-11-17T12:28:00Z'
updated_date: '2026-11-17T14:26:00Z'
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
- [ ] #1 Beams render without JavaScript, fade before they reach body text and are dimmer on inner pages than on the landing
- [ ] #2 Measured in both themes at phone and desktop widths, text over the brightest point of a beam keeps at least 4.5:1
- [ ] #3 The motion honours prefers-reduced-motion and keeps a pause control (decision-39)
- [ ] #4 three.js and the LightField island are removed if nothing else uses them
- [ ] #5 favicon.svg and the OG images use the Corner L mark and the new palette
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
<!-- SECTION:NOTES:END -->
