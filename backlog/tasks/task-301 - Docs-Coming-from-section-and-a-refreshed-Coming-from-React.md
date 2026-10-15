---
id: TASK-301
title: 'Docs: Coming from section and a refreshed Coming from React'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-15 02:22'
labels:
  - docs
milestone: m-10
dependencies: []
priority: medium
ordinal: 303000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user wants Coming from guides for React Router, Next.js, React and Solid (2026-10-15). Coming from React already exists (TASK-232, packages/lumiose/docs/coming-from-react.md). Give the four guides a section of their own in the docs (index, site navigation, llms.txt), move Coming from React into it and refresh it against the current API.

The guides map concepts to the current API only; they are not migration or upgrade guides (decision-47). They share one outline so people and agents find things in the same place: mental model, a table from the other framework's APIs to Lumiose's, what has no equivalent and what to do instead, an example, related pages. M10's feature tasks update the guides as they land.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The docs have a Coming from section listing the four guides, in the docs index, the site navigation and llms.txt
- [ ] #2 Coming from React lives in that section, refreshed against the current API, and links to it resolve
- [ ] #3 The shared outline for the guides is set
- [ ] #4 docs:gen, docs:check and the docs tests pass
<!-- AC:END -->
