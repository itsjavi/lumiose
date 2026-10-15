---
id: TASK-409
title: Flaky temp-dir cleanup in packages/vite's svg test
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-15 23:37'
labels:
  - build
  - test
dependencies: []
priority: low
ordinal: 408000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Seen at the batch 5 merge (2026-10-16): packages/vite/src/svg.test.ts failed once in pnpm check with ENOTEMPTY when removing its temporary app's node_modules/.vite/deps directory. Vite's optimizer was probably still writing to it. It passed on rerun. Make the cleanup robust (rm with recursive, force and retries, or close the server before removing) so CI does not flake.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The svg test's cleanup cannot fail on a directory the optimizer still writes
<!-- AC:END -->
