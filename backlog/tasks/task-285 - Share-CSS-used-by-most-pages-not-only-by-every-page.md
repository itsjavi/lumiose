---
id: TASK-285
title: 'Share CSS used by most pages, not only by every page'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-14 03:47'
labels:
  - css
  - build
  - performance
dependencies: []
priority: medium
ordinal: 287000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the itsjavi.com port to Lumiose 0.4.0 (the port's FINDINGS.md), gap 8. The merged shared stylesheet is the longest common prefix of every page's list (packages/vite/src/app/production/stylesheets.ts). One page without the site chrome (the port's fullscreen editor, outside a (site) route group) drops the header, footer and catalog CSS from the shared file, so each page's merged file repeats them: 38 CSS files and 207 kB on the port against Astro's 3 files and 45 kB, though each page still downloads less CSS than with Astro. Consider sharing by route group layout, or CSS used by most pages, and measure on the sample apps and the port.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Shared CSS no longer depends on every page having the same prefix, or the measured trade-off is recorded and the current rule kept
- [ ] #2 concepts/styles.md (In builds) matches the rule
<!-- AC:END -->
