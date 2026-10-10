---
id: TASK-210
title: Audit Lumiose's production dependency count and server output size
status: To Do
assignee:
  - Lux
created_date: '2026-10-10 22:41'
labels:
  - size
  - positioning
milestone: m-7
dependencies: []
priority: medium
ordinal: 212000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-37 (positioning, approved by the user 2026-10-11; notes in .local/positioning/): the fullstack benchmark counts 139 production dependency packages for the Lumiose app against 81 (React Router) and 28 (Next.js), and 168 kB of server output against React Router's 72 kB. Find what pulls them in (for example build-time packages in dependencies), fix what is misplaced, and record what remains and why.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The production dependency tree of the benchmark app is explained package by package group
- [ ] #2 Misplaced dependencies are moved, and the fullstack 'other' metrics are rerun and committed
- [ ] #3 The server output size is explained, with any reductions made
<!-- AC:END -->
