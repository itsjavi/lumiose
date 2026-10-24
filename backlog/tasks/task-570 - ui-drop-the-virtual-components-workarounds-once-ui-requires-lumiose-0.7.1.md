---
id: TASK-570
title: 'ui: drop the virtual components'' workarounds once ui requires lumiose 0.7.1'
status: To Do
assignee:
  - Halo
created_date: '2026-10-24 18:23'
labels:
  - ui
dependencies: []
priority: low
ordinal: 562000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The virtual components (TASK-565, decision-84) work around two 0.7.0 bugs fixed for 0.7.1: TASK-567 (each row's item goes through a computed) and TASK-568 (measured rows are observed from the container instead of an attach next to a spread). Keep the workarounds while @lumiose/ui's peer range allows lumiose 0.7.0; drop them in the ui release whose peer range requires 0.7.1 or later, with the components' tests still green.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The workarounds are gone in a ui release that requires lumiose >=0.7.1, with the tests green
<!-- AC:END -->
