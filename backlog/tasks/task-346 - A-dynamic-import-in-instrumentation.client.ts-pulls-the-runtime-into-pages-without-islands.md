---
id: TASK-346
title: >-
  A dynamic import in instrumentation.client.ts pulls the runtime into pages
  without islands
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-15 12:36'
updated_date: '2026-10-15 16:57'
labels:
  - build
  - performance
dependencies: []
priority: medium
ordinal: 348000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the TASK-332 spike (Halo, 2026-10-15) while prototyping @lumiose/ui widgets; details in TASK-332's notes and examples/ui-spike. When src/instrumentation.client.ts uses a dynamic import(), Vite's preload helper lands in the runtime chunk, so pages without islands or SPA routes download the 10.8 kB runtime anyway, against decision-49's promise that those pages load only the file and its imports.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A page without islands loads only the client entry and its imports, also when the entry uses import()
- [x] #2 A build test covers it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Nova): Cause: the build's runtime group (packages/vite/src/app/production/client-runtime.ts) took Vite's preload helper, so the client entry's import() imported it from the runtime chunk. Fix: in buildEnd, clientEntryHelpers() (runtime-chunks.ts) finds the Vite/Rolldown helpers the client entry reaches through static imports. Unless the entry imports the runtime itself, helpers the runtime also uses go to a 'helpers' chunk (a group listed before the runtime's, since a group takes its modules' dependencies), and helpers only the entry uses stay in its chunk. Trade-off: pages with islands load one more small file (0.33 kB brotli) when the client entry uses import().
Evidence: build test 'keeps the runtime off pages without islands when src/instrumentation.client.ts uses import() (TASK-346)' and clientEntryHelpers() unit tests; examples/ui-spike: the instrumentation chunk now imports helpers-[hash].js (329 B brotli) instead of the 10.6 kB brotli runtime chunk on /b. Docs: concepts/islands.md (the client entry's imports, import() included). Validation: vitest packages/vite/src/app/production (56 passed).
<!-- SECTION:NOTES:END -->
