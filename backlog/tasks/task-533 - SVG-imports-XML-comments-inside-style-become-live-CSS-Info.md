---
id: TASK-533
title: 'SVG imports: XML comments inside <style> become live CSS (Info)'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-23 18:09'
labels:
  - security
dependencies: []
priority: low
ordinal: 526000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
0.6.0 delta review: crates/lumiose_svg/src/emit.rs:296 takes roxmltree's text() of <style>, which includes comment content, so commented-out CSS comes alive. Not a bypass (the filter reads the merged text). Filter children with is_text().
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Comments inside an SVG <style> are dropped, with a test
<!-- AC:END -->
