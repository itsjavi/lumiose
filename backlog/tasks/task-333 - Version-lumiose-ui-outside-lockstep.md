---
id: TASK-333
title: Version @lumiose/ui outside lockstep
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-15 04:03'
labels:
  - release
milestone: m-12
dependencies:
  - TASK-332
priority: low
ordinal: 335000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-54, @lumiose/ui keeps its own 0.x versions until its own 1.0, outside the lockstep versions of pnpm release:version. The release script supports a package with its own version and changelog.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 release:version releases @lumiose/ui with its own version and changelog, leaving lockstep packages alone
- [ ] #2 The release docs explain the exception
<!-- AC:END -->
