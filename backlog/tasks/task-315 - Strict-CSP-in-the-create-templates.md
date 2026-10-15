---
id: TASK-315
title: Strict CSP in the create templates
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-15 04:02'
labels:
  - security
milestone: m-11
dependencies: []
priority: medium
ordinal: 317000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-56: every template of @lumiose/create sets lumiose({ csp: "strict" }); the framework default stays off. The templates' own scripts and styles must work under it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every create template sets csp: "strict" and its pages run without CSP violations
- [ ] #2 Getting started and concepts/security.md say that new projects start with a strict CSP
<!-- AC:END -->
