---
id: TASK-211
title: 'Landing: live editable .stsx demo island'
status: To Do
assignee:
  - Beacon
created_date: '2026-10-10 22:41'
labels:
  - landing
  - positioning
milestone: m-7
dependencies: []
priority: medium
ordinal: 213000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-37 (positioning, approved by the user 2026-10-11; notes in .local/positioning/): the 'Familiar to write' section shows code as an editable island built on the playground's WASM compiler and preview runtime. Edit a .stsx sample, see the JS output, the CSS output and the rendered result update. None of the eight competitor landing pages lets visitors edit code. The WASM loads only when the island becomes visible, so the landing's initial payload stays light.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Edits compile in the browser and update the JS output, CSS output and preview
- [ ] #2 The compiler and WASM load only when the island is visible; the landing's initial JS is unchanged
- [ ] #3 Without JavaScript the section still shows the sample and its output as static tabs; an e2e test covers editing
<!-- AC:END -->
