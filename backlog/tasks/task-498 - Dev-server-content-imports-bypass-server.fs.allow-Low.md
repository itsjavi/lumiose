---
id: TASK-498
title: 'Dev server: content imports bypass server.fs.allow (Low)'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-20 23:55'
labels:
  - security
dependencies: []
priority: medium
ordinal: 494000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Delta review finding S2, older than this delta (dev only): packages/vite/src/content.ts:107 (#kind) and the load hook at 194-245 read any .md/.html on disk; Vite 8 checks fs.allow only when no plugin loads the id. With --host, GET /@fs/<outside>/notes.md.stsx?import returned the file, and /@fs/<outside>/page.html?import&lumiose-script&index=0&lang.js its inline script. TASK-283 now emits such /@fs URLs itself. Fix: in serve mode refuse files that fail isFileLoadingAllowed(config, file).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In dev, a content import outside server.fs.allow gets 403, as Vite's own files do; a test covers .md and .html
<!-- AC:END -->
