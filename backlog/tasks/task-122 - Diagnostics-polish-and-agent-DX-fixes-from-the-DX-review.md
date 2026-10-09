---
id: TASK-122
title: Diagnostics polish and agent-DX fixes from the DX review
status: To Do
assignee:
  - Beacon
created_date: '2026-10-09 04:20'
labels:
  - tooling
  - docs
dependencies: []
priority: low
ordinal: 122000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-38 findings 9, 10, 16, 17 (except create-lumen --mcp, a pending user proposal): suppress TS errors inside LUM1006 spans; note hidden semantic errors while syntax errors exist; strip stacks after LUMxxxx build errors (small vite/ edit approved); replace lumen.dev/errors links with the lumen docs hint until the site exists; declare *.css in lumen/env; lumen docs/docs_get with an exact export name prints its reference section; MCP render gets a stripped mode.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each listed item fixed with tests where testable; docs updated
<!-- AC:END -->
