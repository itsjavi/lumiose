---
id: TASK-251
title: 'Realtime guide: server-sent events and WebSockets'
status: To Do
assignee:
  - Beacon
created_date: '2026-10-12 18:40'
updated_date: '2026-10-12 19:31'
labels:
  - docs
  - adapter
milestone: m-9
dependencies:
  - TASK-253
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
- [ ] #2 WebSocket docs with a tested ws example through createServer().server's upgrade event, and per-platform notes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: no new adapter-node API (decision-45): ws attaches via server.on('upgrade'). Now docs + example work: reassigned Nova -> Beacon (Nova overloaded); waits for TASK-253 so the example uses the new route files. Beacon may create examples/ssr-realtime.
<!-- SECTION:NOTES:END -->
