---
id: TASK-602
title: 'site-kit tokens: black, white, one grey and one amber accent in both themes'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-11-17T12:28:00Z'
labels: []
milestone: m-16
dependencies: []
references:
  - backlog/assets/redesign/b-first-light.html
ordinal: 594000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the site-kit colour, radius and type tokens with the palette and type of the redesign reference (decision-90): black and white, one mid grey, hairline and soft-surface greys, one warm amber accent, square corners, mono uppercase labels.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tokens match the reference in both themes: dark (#000, #fff, grey #a3a3a3, accent #ffd27a) and light (#fff, #000, grey #595959, accent #f5a300)
- [ ] #2 A test computes contrast for every text token on every surface token: at least 4.5:1, and 7:1 for the grey on the page background
- [ ] #3 Amber is never a text colour or a focus ring; focus rings use the text colour
- [ ] #4 Old brand colours (violet, gradients) and rounded radii are gone from the tokens
- [ ] #5 Every site-kit consumer still builds and type-checks
<!-- AC:END -->
