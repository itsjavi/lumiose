---
id: TASK-342
title: Follow renamed CSS files from the final build output
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-15 07:41'
labels:
  - build
  - css
milestone: m-11
dependencies:
  - TASK-335
priority: low
ordinal: 344000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the TASK-335 StyleX spike, approved by the user on 2026-10-15 as a robustness fix with no new API. Lumiose records each route's CSS files before other plugins finish, so a plugin that renames or rewrites a CSS asset afterwards (StyleX does) leaves pages linking a file that no longer exists. Read each route's CSS from the final build output instead (packages/vite/src/app/production). StyleX stays documented as not supported in .stsx files, and no public option links one stylesheet on every page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Pages link the CSS files the final build output contains, also when another plugin renamed them
- [ ] #2 A test covers a plugin that renames a CSS asset after Lumiose
- [ ] #3 concepts/styles.md stays accurate about StyleX
<!-- AC:END -->
