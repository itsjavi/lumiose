---
id: TASK-144
title: 'Regression: spa-router-e2e build project fails to hydrate (insertBefore)'
status: To Do
assignee:
  - Photon
created_date: '2026-10-09 05:19'
labels:
  - bug
  - hydration
dependencies: []
priority: high
ordinal: 144000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Spark (TASK-125): on plain HEAD (19142b5), 10 of 11 tests in the spa-router-e2e 'build' Playwright project fail with "Failed to execute 'insertBefore' on 'Node'" during hydration; it passed 22/22 right after TASK-123 (2841919). Candidates since then: 596bfbd (TASK-65 insertText codegen), 5588b5d (TASK-117 attribute folding), 9a3d567/786f039 (TASK-121 stylesheets), 1e18311 (TASK-138 CSP), 19142b5 (TASK-125). Bisect, fix in the owning area (Spark's dom/hydrate authorised for this task), add a regression test.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Bisected to the commit that broke it, with the root cause in the notes
- [ ] #2 spa-router-e2e (dev and build), islands-e2e and the sample apps' Playwright suites pass; a unit/parity test covers the case
<!-- AC:END -->
