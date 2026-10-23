---
id: TASK-525
title: 'searchParams.set() percent-encodes : and , in query values'
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-23 08:17'
labels:
  - router
  - dx
milestone: m-13
dependencies: []
priority: low
ordinal: 519000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by a port of a private app of the author's (TASK-492, doc-11). The list page keeps a multi-column sort in its query, sorts=price:desc,name:asc, as the original's URL-state library writes it. searchParams.set() writes sorts=price%3Adesc%2Cname%3Aasc (URLSearchParams.toString()). Both decode to the same value and old links keep working, but the shareable URL is harder to read and differs from the original's. Option: serialize with the minimal encoding a query needs, keeping characters such as : , / @ that are valid in a query value, as that library does.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 searchParams.set() leaves : and , readable in query values, with a test
- [ ] #2 Values with &, =, + and # still round-trip, with a test
<!-- AC:END -->
