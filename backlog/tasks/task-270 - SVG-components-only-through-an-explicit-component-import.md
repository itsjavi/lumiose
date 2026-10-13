---
id: TASK-270
title: SVG components only through an explicit ?component import
status: Done
assignee:
  - Lux
created_date: '2026-10-13 23:45'
updated_date: '2026-10-13 23:51'
labels: []
dependencies: []
ordinal: 272000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-14: an .svg import is a component only with ?component, in project files and node_modules alike (Lucide and other icon sets). A bare .svg import, ?inline, ?url and ?raw are Vite's again. lumiose/env drops its bare *.svg declaration, ending the vite/client clash (TASK-122). No deprecation alias.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ?component loads any .svg as the inline component, project or node_modules, with Vite's ?v=/?import queries around it, on the client and the server
- [x] #2 A bare .svg, ?inline, ?url and ?raw import are Vite's own; lumiose/env declares *.svg?component and no bare *.svg
- [x] #3 Tests, docs (concepts/svg, reference/jsx, reference/vite) and llms files updated; pnpm check scope green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (standalone; svg.ts is Halo's in Photon's plugin, types Beacon's): SVG_COMPONENT matches component among the query params (Vite dev requests ?import&component, deps may get &v=); the node_modules exclude is gone. lumiose/env: *.svg?component, ?url, ?raw; no bare *.svg, so vite/client loads in any order with skipLibCheck off (jsx-types test). Decisions 46/47, decision-22 amended. Docs: concepts/svg, reference/jsx, reference/vite, index; llms regenerated. Checks: vitest packages/vite + lumiose/src/jsx + docs (193 tests), tsc for both packages, oxlint, oxfmt, docs:check. Real lucide-static 1.56.0 in a scratch app outside the repo: dev client and SSR, production client build (path data inlined, no .svg asset) and SSR build all render the icons.
<!-- SECTION:NOTES:END -->
