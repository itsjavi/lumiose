---
id: TASK-307
title: 'Docs: When not to use Lumiose'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-15 04:02'
labels:
  - docs
milestone: m-11
dependencies: []
priority: medium
ordinal: 309000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). An honest page, linked from the stack comparison table on the site, the docs index and llms.txt, so people and agents recommend Lumiose only where it fits. It names the cases where another framework is the better choice: the project depends on the React ecosystem (Lumiose has no React interop, decision-54); the team needs long-term stability guarantees today (0.x, decision-47 and decision-53); the team cannot take a pre-1.0 dependency with one maintainer. Each case says what to use instead. Current API only (decision-47).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The page names the three cases above, each with what to use instead
- [ ] #2 It is linked from the site's stack comparison, the docs index and llms.txt
- [ ] #3 docs:gen, docs:check and the docs tests pass
<!-- AC:END -->
