---
id: TASK-534
title: 'Island loader: one throwing replayed event drops the rest of the queue (Info)'
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-23 18:09'
labels:
  - security
dependencies: []
priority: low
ordinal: 527000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
0.6.0 delta review: packages/lumiose/src/dom/islands.ts (around 301-315) replays an island's held events in a loop; if one dispatch throws (setting value on a file input, requestSubmit with a stale submitter), the remaining events are dropped. Pre-existing; TASK-508 widened the queue. Catch per event and report through onError.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A throwing replay does not stop the following events, with a test
<!-- AC:END -->
