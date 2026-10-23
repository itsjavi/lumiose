---
id: TASK-532
title: 'SVG imports: handle CSS image() like image-set() (Info)'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-23 18:09'
labels:
  - security
dependencies: []
priority: low
ordinal: 525000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
0.6.0 delta review: crates/lumiose_svg/src/prefix.rs (around 286-293) keeps image("http://…") in CSS. No shipping browser implements image() today, so this is hardening: fail closed like image-set.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An external URL inside image() is removed, with a security test
<!-- AC:END -->
