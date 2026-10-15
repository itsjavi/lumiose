---
id: TASK-324
title: 'Docs: testing with Testing Library and Playwright'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-15 04:03'
labels:
  - docs
  - testing
milestone: m-11
dependencies: []
priority: medium
ordinal: 326000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-57: concepts/testing.md shows @testing-library/dom and @testing-library/user-event with lumiose/dom's render() (queries, events, cleanup) and Playwright for end-to-end tests. No adapter package and no component workshop before 1.0.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The docs show a component test with Testing Library queries and user-event, type-checked
- [ ] #2 They show a Playwright end-to-end setup
- [ ] #3 docs:gen, docs:check and the docs tests pass
<!-- AC:END -->
