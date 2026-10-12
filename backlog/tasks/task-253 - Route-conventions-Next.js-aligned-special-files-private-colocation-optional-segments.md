---
id: TASK-253
title: >-
  Route conventions: Next.js-aligned special files, private colocation, optional
  segments
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-12 18:40'
updated_date: '2026-10-12 19:31'
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
Decision-42 as amended on 2026-10-12: Next.js App Router file conventions only. page.stsx/page.tsx (no index, no flat page files), route.ts endpoints (no other .ts endpoints), layout / not-found / error (replacing _layout / _404 / _error), any other file is colocated and ignored, _-prefixed folders are private, [param], [...rest] (one or more), [[...rest]], [[param]], (group). Unsupported Next.js special files (loading, template, default, global-error, @slot, (.)) are LUM5002. No backwards compatibility: no rename diagnostic, no upgrading section. Breaking and cross-cutting: one owner (Nova) moves every app in the repo (examples, apps/web, benchmarks/fullstack/apps/lumiose, create templates, language server, CLI, docs) with Lux's go-ahead; nothing else runs on those paths meanwhile.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Manifest, matcher, typegen, typed href() and lumiose routes implement decision-42's conventions (page, route, layout, not-found, error, colocation, private folders, optional segments)
- [ ] #2 Duplicates (page + route in one folder) stay LUM5003; unsupported Next.js special files are LUM5002; tests cover both
- [ ] #3 Docs, create templates, examples, benchmarks and the website use the new conventions; language server and CLI updated; pnpm check green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: user amended decision-42 (Next.js conventions only, no compat). Nova owns the whole task including other agents' paths; Lux serializes those paths while it runs.
<!-- SECTION:NOTES:END -->
