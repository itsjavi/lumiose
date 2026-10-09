---
id: TASK-172
title: spa-chiptune on GitHub Pages with cross-origin isolation
status: In Progress
assignee:
  - Chime
created_date: '2026-10-09 12:12'
updated_date: '2026-10-09 12:15'
labels:
  - samples
  - site
milestone: m-7
dependencies: []
priority: medium
ordinal: 172000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-09: make the chiptune work on GitHub Pages without throwing away its SharedArrayBuffer optimisations. Pages cannot send COOP/COEP headers. Lux authorises edits in examples/spa-chiptune (Spark's area; Spark is on security work).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A small first-party service worker (no third-party lib) adds COOP/COEP to same-origin responses on hosts without them, enabled for the Pages build only; real headers (lumen({ headers })) stay the primary path; the non-isolated fallback keeps working when the SW is unavailable
- [ ] #2 Under the Pages base path: deep links, the audio engine in SharedArrayBuffer mode (Settings shows it), and an e2e check against preview:site; README explains the trade-off (one reload on first visit)
- [ ] #3 Also update spa-dotmatrix's README: gbapu is the user's own library, planned for MIT release
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (TASK-163, 2026-10-09): how the Pages build runs the examples: scripts/site.ts builds each with LUMEN_BASE=<base>examples/<name>/ (vite.config base reads it) and LUMEN_PAGES=1, the flag to enable the service worker for the Pages build only; dist/client is copied to dist/site/examples/spa-chiptune/ without .br/.gz and _headers. Deep links: Pages serves the root 404.html for missing paths; site.ts injects a script there that, below examples/spa-chiptune/, swallows the site's page (<plaintext>) and document.writes the chiptune's own 404.html (the SPA shell), so the router renders the deep link with a 404 status. So the SW script should live in the chiptune's output root (scope examples/spa-chiptune/) and the registration in the shell works both from index.html and from the 404 fallback. Validate with pnpm build:site --base /lumen/ && pnpm preview:site --base /lumen/ (preview mimics Pages: directory index.html, root 404.html).
<!-- SECTION:NOTES:END -->
