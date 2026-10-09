---
id: TASK-172
title: spa-chiptune on GitHub Pages with cross-origin isolation
status: To Do
assignee:
  - Chime
created_date: '2026-10-09 12:12'
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
