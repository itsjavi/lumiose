---
id: TASK-279
title: 'Proposal: first-party responsive images'
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-14 03:47'
labels:
  - proposal
  - images
  - dx
dependencies: []
priority: medium
ordinal: 281000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the itsjavi.com port to Lumiose 0.4.0 (the port's FINDINGS.md), gap 2. Lumiose has no image component or asset API; the port uses vite-imagetools through import.meta.glob queries. Costs: a glob query is a literal, so each glob resizes every matched file to one fixed set of widths (229 image files against Astro's 185); an eager glob emits every file it matches, used or not (a 1 MB unused PNG had to be moved out of a glob's reach); in dev every image is resized on the first request (cold start to the first page 4.6 s against Astro's 2.0 s, 0.8 s with a warm cache). Options: (a) document the vite-imagetools recipe and its traps; (b) a first-party helper or component that resizes per use and lazily in dev. Any new API name needs the user's approval.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision is recorded: a documented recipe, or a specified first-party API approved by the user
<!-- AC:END -->
