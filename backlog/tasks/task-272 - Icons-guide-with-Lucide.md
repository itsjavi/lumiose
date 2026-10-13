---
id: TASK-272
title: Icons guide with Lucide
status: Done
assignee:
  - Lux
created_date: '2026-10-13 23:45'
updated_date: '2026-10-13 23:53'
labels: []
dependencies:
  - TASK-270
ordinal: 274000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A docs guide (docs/guides/icons.md) for icon sets through ?component SVG imports, with Lucide (lucide-static) as the worked example: install, import, size and colour with CSS, labels; other SVG icon sets work the same; why lucide-react and Lucide's runtime package do not fit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 docs/guides/icons.md, linked from the docs index, verified against a real lucide-static install
- [x] #2 docs:gen, docs:check and docs tests green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: docs/guides/icons.md (install as a dev dependency, use, size/colour/stroke, labels, other sets, why not lucide-react/lucide, common mistakes), linked from the docs index and concepts/svg. Every claim checked against lucide-static 1.56.0 in a scratch app outside the repo: dev and production client/SSR builds render the icons, the server bundle inlines them (no runtime lucide-static import), tsc types lucide-static/...svg?component and ?url through lumiose/env. docs:gen/check, docs tests (34) green; page renders in the web dev server with sidebar entry and no broken links.
<!-- SECTION:NOTES:END -->
