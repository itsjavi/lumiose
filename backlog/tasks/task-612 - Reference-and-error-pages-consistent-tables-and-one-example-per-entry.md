---
id: TASK-612
title: 'Reference and error pages: consistent tables and one example per entry'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-11-17T12:29:00Z'
labels: []
milestone: m-16
dependencies:
  - TASK-609
references:
  - backlog/assets/redesign/b-first-light.html
ordinal: 604000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bring docs/reference and docs/errors in line with the writing guide: a signature, a one-line summary, one example and a table of options per entry; error pages show the failing code and the fix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every reference entry has a signature, a summary and an example
- [ ] #2 Every error page shows a failing example and its fix
- [ ] #3 docs:gen output, docs:check and the docs tests are green
<!-- AC:END -->
