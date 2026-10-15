---
id: TASK-340
title: Implement response().setStreaming(false) and streamTimeout
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-15 07:41'
labels:
  - app-layer
milestone: m-10
dependencies:
  - TASK-306
priority: medium
ordinal: 342000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implements decision-58 (proposal in TASK-306, approved by the user on 2026-10-15). `response().setStreaming(false)`, callable in middleware or a page until the shell is sent (like setStatus and setHeader; LUM5004 after), makes the render resolve every <Suspense> boundary and send one complete document (the prerender path of renderPage in packages/lumiose/src/app/server/handler.ts). `lumiose({ streamTimeout })` takes a duration ("30s" or milliseconds), default 30 seconds, false to disable; when it expires, every pending boundary rejects with a timeout error, the nearest ErrorBoundary renders into the stream, onRequestError gets phase "stream", and the response ends. Prerendering ignores it. Crawler handling is a docs recipe (middleware plus the isbot package), with no built-in bot list.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 response().setStreaming(false) before the shell sends one fully resolved document; after the shell it is LUM5004
- [ ] #2 streamTimeout defaults to 30 s, accepts a duration or false, and a boundary pending past it renders its ErrorBoundary and reaches onRequestError with phase stream
- [ ] #3 Prerendering ignores streamTimeout
- [ ] #4 Tests cover both in dev, preview and the Node adapter
- [ ] #5 concepts/server.md, concepts/rendering-modes.md, reference/vite.md and reference/app.md describe them, with the crawler recipe
<!-- AC:END -->
