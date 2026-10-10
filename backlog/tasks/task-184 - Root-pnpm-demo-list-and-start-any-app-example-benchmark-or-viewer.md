---
id: TASK-184
title: 'Root ''pnpm demo'': list and start any app, example, benchmark or viewer'
status: Done
assignee:
  - Quasar
created_date: '2026-10-10 00:27'
updated_date: '2026-10-10 01:11'
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
- [x] #1 pnpm demo lists every HTML-serving package (picker + non-interactive --list) and starts the chosen one in dev or --prod; fuzzy names; tests for discovery and matching
- [x] #2 README documents it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Quasar (quasar-20261009T142003Z) started. Scope (per Lux, Photon restructures packages in TASK-39): scripts/demo.ts (+ test), the root package.json script line, a small per-package metadata field, README section.

Quasar: done. scripts/demo.ts (root script `pnpm demo`), tests scripts/demo.test.ts (node --test, 9 pass: discovery from a temp workspace and from this repo, metadata, grouping, fuzzy matching incl. ambiguity, port flag/env planning, setup/build steps, URL detection), README section. Discovery: pnpm-workspace.yaml globs → packages with dev/view/start/serve/preview; prod = build + preview|start|serve (viewers: view). package.json `demo` metadata ({title, kind, name?, setup?, port?} or false) added to the 15 HTML-serving packages (commit 6d? 'chore(demo)'); tracker apps get setup ["seed"]; both results viewers now honour PORT. Ctrl+C sends SIGINT to the server's process group (SIGTERM/SIGKILL fallbacks) and exits 0. Verified by hand: vite-counter dev (URL printed, Ctrl+C leaves nothing listening), eval-viewer, tracker-lumiose (seed then dev). Note: tracker-lumiose dev and ssr-bookshelf --prod currently fail inside the app because of Photon's in-progress package move (packages/vite files missing in the working tree), not demo.ts. Committed only my hunks (Photon's staged renames and dependency edits untouched).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
pnpm demo: interactive grouped picker, fuzzy names, --list/--json, --prod (build + preview/start/serve), --port, --open; discovery from workspace scripts plus a package.json demo field; prints the URL when the server answers; clean Ctrl+C. Tests in scripts/demo.test.ts; README documents it.
<!-- SECTION:FINAL_SUMMARY:END -->
