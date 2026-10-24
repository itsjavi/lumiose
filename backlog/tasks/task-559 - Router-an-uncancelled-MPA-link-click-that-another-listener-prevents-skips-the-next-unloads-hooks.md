---
id: TASK-559
title: >-
  Router: an uncancelled MPA link click that another listener prevents skips the
  next unload's hooks
status: To Do
assignee:
  - Spark
created_date: '2026-10-24 12:19'
labels:
  - router
dependencies: []
priority: low
ordinal: 551000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prism's 0.7.0 review FYI (not security). hooks.ts sets unloading = 1 after a link click its hooks did not cancel. If a window click listener registered after Lumiose's prevents that click, the next real unload skips the hooks and the browser's prompt once, so an unsaved-changes guard is lost once. The SPA path through leaveTo behaved the same before.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A click prevented after the hooks ran does not mark the page as unloading (or the docs say why), with a test
<!-- AC:END -->
