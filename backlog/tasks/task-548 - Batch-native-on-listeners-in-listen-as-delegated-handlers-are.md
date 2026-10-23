---
id: TASK-548
title: 'Batch native on: listeners in listen(), as delegated handlers are'
status: To Do
assignee:
  - Spark
created_date: '2026-10-23 21:59'
labels:
  - core
  - dom
dependencies: []
priority: low
ordinal: 540000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up of TASK-540. @lumiose/ui now wraps its native `on:` listeners and callbacks in batch(), so their writes render together and the DOM is current right after the event, like delegated handlers. Lumiose's own `listen()` could do the same for every app's native listeners. It changes when an app's DOM updates after a native event, so it is a behaviour change for a minor release, with a test and the docs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 listen() runs native listeners inside batch(), or the docs say why not
- [ ] #2 Tests show the DOM is current right after a native event; the docs describe it
<!-- AC:END -->
