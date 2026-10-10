---
id: TASK-184
title: 'Root ''pnpm demo'': list and start any app, example, benchmark or viewer'
status: To Do
assignee:
  - Quasar
created_date: '2026-10-10 00:27'
labels:
  - dx
  - tooling
dependencies:
  - TASK-182
priority: medium
ordinal: 184000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-10: a way in the root package to view/start anything in the repo that has an HTML server. Design: 'pnpm demo' with no args shows an interactive picker grouped by kind (examples, website/playground, benchmark viewers and fullstack bench apps, eval viewer, e2e test apps); 'pnpm demo <name>' with fuzzy match; --prod (build + preview/start), --port, --open. Entries are discovered from workspace packages' dev/preview/start/view scripts (plus a small metadata field for title/kind), so new apps appear automatically; prints the URL when ready; Ctrl+C stops it cleanly. Start after the rename (TASK-182) lands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pnpm demo lists every HTML-serving package (picker + non-interactive --list) and starts the chosen one in dev or --prod; fuzzy names; tests for discovery and matching
- [ ] #2 README documents it
<!-- AC:END -->
