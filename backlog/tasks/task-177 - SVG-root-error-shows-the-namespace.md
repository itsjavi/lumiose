---
id: TASK-177
title: SVG root error shows the namespace
status: Done
assignee:
  - Halo
created_date: '2026-10-09 14:25'
updated_date: '2026-10-09 15:42'
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
- [x] #1 Message names the actual prefix/namespace and the expected SVG namespace; test
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A root <svg> in another namespace now reports 'the root element is <svg> in the namespace <uri>, expected the SVG namespace http://www.w3.org/2000/svg'; unit test in lumen_svg.
<!-- SECTION:FINAL_SUMMARY:END -->
