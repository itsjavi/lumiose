---
id: TASK-310
title: External security review before 1.0
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-15 04:02'
labels:
  - security
  - needs-decision
milestone: m-11
dependencies: []
priority: low
ordinal: 312000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). A 1.0 criterion (decision-53, decision-56): an independent reviewer (a paid audit or an experienced community security reviewer) reviews the request handler, form actions and the Origin check, body parsing and limits, cookies and signing, redirects and unsafe URL blocking, SSR escaping and CSP, the SVG, Markdown and HTML sanitizers, and the dev server's file serving. The reviewer and any budget need the user's approval.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The user approves the reviewer, scope and budget
- [ ] #2 The review is done and its report summarized in this task
- [ ] #3 Every finding is fixed or tracked as a task
<!-- AC:END -->
