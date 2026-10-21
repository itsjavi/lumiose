---
id: TASK-493
title: 'Private app: forms, actions and auth port, with a scorecard'
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-20 21:23'
updated_date: '2026-10-21 02:01'
labels: []
milestone: m-13
dependencies:
  - TASK-492
priority: low
ordinal: 489000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-70, later: port a forms, actions and auth slice of the same private app as the proof for those features. Use Better Auth with email one-time codes instead of the app's own auth system, and port the user onboarding step. Record the scorecard in doc-11 without naming the app or describing its code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Sign-in by email code, onboarding and the ported pages work end to end
- [ ] #2 doc-11 holds the scorecard (stacks and numbers only); gaps become tasks
<!-- AC:END -->
