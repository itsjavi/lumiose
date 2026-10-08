---
id: TASK-100
title: Link prefetch control on MPA pages
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 21:52'
labels: []
milestone: m-3
dependencies:
  - TASK-93
priority: medium
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user decided (decision-24 amendment) that <Link prefetch> is the per-link prefetch control everywhere: on MPA pages it renders a plain <a> that the generated speculation rules include or exclude (none/hover/viewport).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 <Link> works outside SPA subtrees (no client router code shipped there), rendering <a> with a marker the speculation rules use: prefetch=none excluded, viewport eager, hover moderate; plain <a> follows the project default
- [ ] #2 Tests (Chromium prefetch behaviour) and docs (routing, reference/router) in the same commits
<!-- AC:END -->
