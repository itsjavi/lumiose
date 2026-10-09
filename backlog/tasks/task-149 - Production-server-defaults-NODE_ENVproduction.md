---
id: TASK-149
title: Production server defaults NODE_ENV=production
status: Done
assignee:
  - Nova
created_date: '2026-10-09 05:28'
updated_date: '2026-10-09 05:30'
labels:
  - adapter
  - server
dependencies: []
priority: low
ordinal: 149000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-145: the bench's Lumen production server ran with NODE_ENV unset because nothing in Lumen sets it (next start does; React Router's template start script does). Libraries that branch on NODE_ENV then run in dev mode. Lumen's built server entry / adapter-node createServer should default it to production when unset (never override an explicit value), and lumen preview should run with it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A built Lumen server started without NODE_ENV runs with NODE_ENV=production; an explicit value is kept; lumen preview sets it; tests; adapter-node docs mention it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova 2026-10-09: 2b0de39. adapter-node loadEntry (createServer/createHandler, so lumen preview too) sets process.env.NODE_ENV ??= 'production' before importing dist/server/entry.js; the generated server entry does the same (guarded for runtimes without process) right after its static CSS-manifest import and before the dynamic import of the runtime and routes, so externalized dependencies see it; verified in a real build output (not folded away). Tests: adapter-node node-env.test.ts (unset -> production as seen by the entry at evaluation; explicit 'staging' kept), build.test.ts asserts the default precedes the first import(). Docs: reference/adapter-node.md (NODE_ENV paragraph), reference/cli.md (preview). adapter-node 22/22, build tests 13/13, docs:check green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built servers (adapter-node, lumen preview, and the server entry itself) default NODE_ENV to production before loading the app; explicit values are kept. Tests and docs updated.
<!-- SECTION:FINAL_SUMMARY:END -->
