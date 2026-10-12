---
id: TASK-253
title: >-
  Route conventions: Next.js-aligned special files, private colocation, optional
  segments
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-12 18:40'
labels:
  - router
  - breaking
milestone: m-9
dependencies: []
priority: high
ordinal: 255000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-42. layout / not-found / error replace _layout / _404 / _error; _-prefixed files and folders are private colocation; [[param]] and [[...rest]] with ranking, typegen and typed href(); page as an alias of index. Old names get a diagnostic with the rename. Touches other agents' areas (examples, apps/web, create templates, language server): coordinate through Lux.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Manifest, matcher, typegen, typed href() and lumiose routes support the new names, private colocation and optional segments
- [ ] #2 Old special names fail with a diagnostic naming the replacement; duplicates (index + page) stay LUM5003
- [ ] #3 Docs, templates, examples and the website use the new conventions; language server and CLI updated
<!-- AC:END -->
