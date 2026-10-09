---
id: TASK-134
title: lumen fmt re-indents multi-line CSS comments in <style> on every run
status: To Do
assignee:
  - Beacon
created_date: '2026-10-09 04:35'
labels:
  - fmt
  - tooling
dependencies: []
priority: medium
ordinal: 134000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-124: lumen fmt is not idempotent for a multi-line /* … */ comment inside a <style> block (examples/ssg-travel-journal _layout.stsx and posts/[slug].stsx, before TASK-124's workaround): each run adds indentation to the comment's continuation lines, so lumen fmt --check never passes. The samples now use one-line comments; restore the multi-line comments once fixed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen fmt is idempotent for multi-line CSS comments in <style> blocks, with a regression test
<!-- AC:END -->
