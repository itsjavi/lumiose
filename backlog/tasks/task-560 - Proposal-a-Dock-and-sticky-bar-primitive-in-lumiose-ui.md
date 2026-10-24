---
id: TASK-560
title: 'Proposal: a Dock and sticky-bar primitive in @lumiose/ui'
status: To Do
assignee:
  - Lux
created_date: '2026-10-24 15:34'
labels:
  - ui
  - proposal
dependencies: []
priority: low
ordinal: 552000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From a port's tracker page (2026-10-24): a fixed bottom toolbar that reserves room at the page's end (a ResizeObserver writes the body's bottom padding) and a top bar that floats once the header's tools row scrolls out of view (an IntersectionObserver). Toast and Drawer already reserve space or position fixed layers, so a shared primitive could serve them. New public API: needs the user's approval before it is built (AGENTS.md). Later than the virtualizer and typed URL state.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The user chose an API (or declined), recorded in a decision
<!-- AC:END -->
