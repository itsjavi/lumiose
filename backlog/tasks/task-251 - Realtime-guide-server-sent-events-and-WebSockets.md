---
id: TASK-251
title: 'Realtime guide: server-sent events and WebSockets'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-12 18:40'
labels:
  - docs
  - adapter
milestone: m-9
dependencies: []
priority: medium
ordinal: 253000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-12: document realtime servers. SSE: an endpoint returning a streamed Response, consumed by an island with EventSource, signals and onCleanup. WebSockets: an upgrade hook in @lumiose/adapter-node so ws can attach; platform notes (Cloudflare Durable Objects; serverless Vercel/Netlify functions need a hosted service).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SSE docs with a tested endpoint + island example (streaming, client disconnect, cleanup)
- [ ] #2 adapter-node exposes an upgrade hook; WebSocket docs with a tested ws example and per-platform notes
<!-- AC:END -->
