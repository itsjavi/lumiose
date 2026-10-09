---
id: TASK-177
title: SVG root error shows the namespace
status: To Do
assignee:
  - Halo
created_date: '2026-10-09 14:25'
labels:
  - svg
  - diagnostics
dependencies: []
priority: low
ordinal: 177000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From TASK-169: an SVG whose root <svg> has a namespace prefix gets 'the root element is <svg>, expected <svg>'; show the prefix/namespace URI so the message makes sense.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Message names the actual prefix/namespace and the expected SVG namespace; test
<!-- AC:END -->
