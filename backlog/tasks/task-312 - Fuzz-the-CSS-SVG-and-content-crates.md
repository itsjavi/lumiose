---
id: TASK-312
title: 'Fuzz the CSS, SVG and content crates'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-15 04:02'
labels:
  - security
  - fuzzing
milestone: m-11
dependencies:
  - TASK-311
priority: medium
ordinal: 314000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-56: cargo-fuzz targets for lumiose_css (style blocks, $ constants, scoping), lumiose_svg (the allowlist sanitizer) and lumiose_content (Markdown, frontmatter and HTML imports, depth limits), with corpora seeded from fixtures, run by the nightly fuzz workflow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Fuzz targets cover lumiose_css, lumiose_svg and lumiose_content with seeded corpora
- [ ] #2 The nightly fuzz workflow runs them
- [ ] #3 Crashes found while adding them are fixed or tracked as tasks
<!-- AC:END -->
