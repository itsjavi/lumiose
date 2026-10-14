---
id: TASK-286
title: 'Proposal: option to skip precompressed copies in static builds'
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-14 03:47'
labels:
  - proposal
  - build
  - deploy
dependencies: []
priority: low
ordinal: 288000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the itsjavi.com port to Lumiose 0.4.0 (the port's FINDINGS.md), gap 9. lumiose build always writes .br and .gz copies; GitHub Pages and most CDNs ignore them, and deploy/static.md tells users to delete them in CI (the port's workflow does). Options: a precompress option, a GitHub Pages adapter, or keep the CI step. A new option name needs the user's approval.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision is recorded; any new option is approved by the user, implemented and documented
<!-- AC:END -->
