---
id: TASK-605
title: 'Site shell: beams of light background, header, footer, favicon and OG images'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-11-17T12:28:00Z'
updated_date: '2026-11-17T12:57:00Z'
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
<!-- SECTION:NOTES:END -->
