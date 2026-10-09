---
id: TASK-151
title: Evaluate server-side props at most once per component instance (decision-28)
status: To Do
assignee:
  - Nova
created_date: '2026-10-09 05:35'
labels:
  - perf
  - server
  - contract
milestone: m-8
dependencies: []
priority: medium
ordinal: 151000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-28: on the server, dynamic props are evaluated lazily at most once per instance (first read caches); client props stay reactive; TASK-78's eager path stays. Implement in the server runtime's createComponent (Nova's area) or in server codegen (Photon) — measure the overhead of a runtime wrapper vs codegen and pick the cheaper; coordinate with Photon through task notes if codegen is needed. The fullstack bench app's FilterFields labels query should drop from 16 to 1 per /projects request without app changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Server props evaluate at most once per instance; unread props never evaluate; parity tests and an SSR test counting evaluations
- [ ] #2 doc-2 §1 note (Lux) and docs on props updated; /projects req/s before/after recorded
<!-- AC:END -->
