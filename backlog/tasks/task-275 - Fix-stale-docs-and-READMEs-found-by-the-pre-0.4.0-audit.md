---
id: TASK-275
title: Fix stale docs and READMEs found by the pre-0.4.0 audit
status: Done
assignee:
  - Lux
created_date: '2026-10-14 00:29'
updated_date: '2026-10-14 00:31'
labels: []
dependencies: []
ordinal: 277000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A read-only audit found docs that no longer match the code: _error/[id].stsx route names after TASK-253, a wrong 'adapter not available' note, a planned lumiose upgrade (contradicts decision-47), LUM3012 reporters, csrf option location, example README paths, CONTRIBUTING's release example, the package count, the site-kit README link, the AGENTS.md segment list, missing prerender export and LUM6xxx range, and the spa template's description.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every confirmed audit finding fixed against the code
- [x] #2 docs:gen/check, docs and cli tests green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: fixed every confirmed and low-priority audit finding: docs README status (pre-1.0, not 0.0.0), vite.md (adapter is available; css is the designed-only option), styles.md LUM3012 reporters, _error -> error page (async, rendering-modes, data-and-actions), route file paths (data-and-actions, router, spa-chiptune and ssg-travel-journal READMEs), csrf option location, cli.md drops the planned lumiose upgrade (decision-47), travel journal's dist/server claim, CONTRIBUTING release example, root README .svg?component, site-kit README link, getting-started package count, AGENTS.md segment list ([[param]]), routing.md prerender export, compiler.md 6xxx range, apps/web CONTRIBUTING paths. The unverified spa-template item is real and needs the user's choice: TASK-276. Checks: docs:gen/check, vitest packages/cli + create + apps/web content (135), oxfmt.
<!-- SECTION:NOTES:END -->
