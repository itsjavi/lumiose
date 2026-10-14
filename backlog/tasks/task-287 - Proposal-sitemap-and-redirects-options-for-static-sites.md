---
id: TASK-287
title: 'Proposal: sitemap and redirects options for static sites'
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-14 03:47'
labels:
  - proposal
  - routing
  - build
dependencies: []
priority: medium
ordinal: 289000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the itsjavi.com port to Lumiose 0.4.0 (the port's FINDINGS.md), gap 10. The port builds its sitemap by listing pages from the same data as the routes (no build-time list of prerendered pages), and each moved URL is a folder with a page that calls redirect(). Astro had a sitemap integration and a redirects map. Options: a sitemap option (or a build API listing prerendered pages for an endpoint), and a redirects map in lumiose(). New options need the user's approval.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision is recorded for both, with the user's approval for any new option
<!-- AC:END -->
