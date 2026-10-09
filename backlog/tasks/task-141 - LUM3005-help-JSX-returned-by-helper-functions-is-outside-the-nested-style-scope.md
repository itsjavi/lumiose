---
id: TASK-141
title: >-
  LUM3005 help: JSX returned by helper functions is outside the nested style
  scope
status: To Do
assignee:
  - Photon
created_date: '2026-10-09 05:10'
labels:
  - compiler
  - css
  - diagnostics
dependencies: []
priority: low
ordinal: 141000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From TASK-133 (Chime): a component-local helper returning JSX (const field = () => <label class="field">…) is not under the component's nested <style> subtree, so its classes get no styles; LUM3005 warns but its help does not explain why. Whether helper JSX should count as in scope is a syntax/DX question for the user (decision-23); this task only improves the help text.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 LUM3005 help names the helper-function case and suggests a top-level <style> block or rendering the JSX inside the styled element; docs/errors/LUM3005.md and styles.md common mistakes updated
<!-- AC:END -->
