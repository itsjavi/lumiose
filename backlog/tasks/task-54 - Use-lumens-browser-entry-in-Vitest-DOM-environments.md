---
id: TASK-54
title: Use lumen's browser entry in Vitest DOM environments
status: To Do
assignee:
  - Photon
created_date: '2026-10-08 15:40'
labels: []
milestone: m-5
dependencies: []
priority: medium
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while writing concepts/testing (TASK-32): with plugins: [lumen()] and a happy-dom/jsdom Vitest environment, `lumen` resolves to its node entry (index.server.ts: signals are plain cells, effects never run), so mounted components render once and never update. Verified in examples/vite-counter with a throwaway test: adding resolve.conditions: ["browser"] makes it pass. The docs currently tell users to add that condition. The plugin (or @lumen/testing) should select browser conditions for DOM test environments automatically, while server-side tests (renderToString) keep the node entry.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A component test with only plugins: [lumen()] and environment happy-dom sees reactive updates
- [ ] #2 Server-render tests without a DOM environment still use the node entry
- [ ] #3 packages/lumen/docs/concepts/testing.md and reference/vite.md drop the manual workaround
<!-- AC:END -->
