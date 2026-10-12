---
id: TASK-251
title: 'Realtime guide: server-sent events and WebSockets'
status: Done
assignee:
  - Beacon
created_date: '2026-10-12 18:40'
updated_date: '2026-10-12 20:59'
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
- [x] #1 SSE docs with a tested endpoint + island example (streaming, client disconnect, cleanup)
- [x] #2 WebSocket docs with a tested ws example through createServer().server's upgrade event, and per-platform notes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: no new adapter-node API (decision-45): ws attaches via server.on('upgrade'). Now docs + example work: reassigned Nova -> Beacon (Nova overloaded); waits for TASK-253 so the example uses the new route files. Beacon may create examples/ssr-realtime.

Beacon 2026-10-12: started. Plan: examples/ssr-realtime with an in-memory pub/sub; SSE endpoint (route.ts, streamed Response, cleanup on request abort / stream cancel) consumed by an island (EventSource, signals, onCleanup); WebSockets with ws attached through createServer().server.on('upgrade') in server.ts and through a Vite plugin in dev; unit test of the SSE stream (abort -> cleanup) and Playwright e2e (SSE broadcast, disconnect cleanup, WS chat, refused upgrade path); docs guides/realtime.md with per-platform notes.

Beacon 2026-10-12, implementation:
- examples/ssr-realtime (@lumiose-examples/ssr-realtime): in-process bus (src/server/bus.server.ts); eventStream(request, start) helper (src/server/event-stream.server.ts: text/event-stream, retry, 15 s keep-alive comments, cleanup exactly once on request abort, stream cancel or close, including a close during start); GET /api/events (route.ts) and /api/stats; /events page with a form action and the LiveFeed island (EventSource -> signals, onCleanup closes it, posts with submit() so the stream stays open); WebSockets with ws 8.22.0 in src/server/chat-socket.server.ts (noServer, /ws only, Origin check -> 403, broadcast), attached in server.ts through createServer().server.on('upgrade') (other paths destroyed, sockets closed on SIGTERM) and in dev through a vite.config.ts plugin on Vite's httpServer (other upgrades left to Vite); Chat island.
- Docs: guides/realtime.md (stream helper, endpoint, island, reconnect/Last-Event-ID, compression, ws on upgrade, dev plugin, preview caveat, auth on the handshake, scaling, proxies, per-platform table, common mistakes); docs/README Guides list; deploy/vps.md links the nginx /ws location.
- Deps (deps.lock): ws 8.22.0, @types/ws 8.18.2 (dev), @playwright/test 1.63.0. No new public API (decision-45).

Evidence: Vitest 7/7 (event stream: events, abort cleanup once, cancel cleanup, endpoint close, close during start, keep-alive; bus). Playwright 4/4 on the production build via server.ts, stable with --repeat-each=3 (SSE broadcast to two pages, closed pages unsubscribe via /api/stats 2->1->0, validation error, WS chat broadcast, cross-site handshake 403, other path refused). Manual: SSE through the adapter with identity/br/gzip delivers each event at once and unsubscribes on abort; lumiose dev SSE + WS + cross-site 403; SIGTERM exits; through nginx (with the documented /ws location and proxy_buffering off) and Caddy (reverse_proxy only): SSE, publish, WS broadcast, cross-site 403; SSE idle 75 s stays open through both (4 keep-alive comments). Repo: typecheck, lint, fmt:examples green; pnpm test 1758 passed, 2 failures in packages/cli/src/cli.test.ts under full-suite load that pass alone (9/9), not related. Screenshot: backlog/assets/task-251-events.png. Platform notes for Cloudflare, Vercel, Netlify are marked not tested.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Realtime guide and sample. packages/lumiose/docs/guides/realtime.md: SSE with an eventStream() helper in a route.ts endpoint (streamed Response, keep-alive, cleanup on disconnect), an island reading it with EventSource, signals and onCleanup; WebSockets with ws attached to createServer().server's upgrade event (no new Lumiose API, decision-45), the same handler in dev through a Vite plugin, an Origin check, nginx and Caddy configs (tested), and per-platform notes (Cloudflare Durable Objects; hosted services for Vercel/Netlify; not tested there). examples/ssr-realtime follows it, with Vitest (7) and Playwright (4) tests of streaming, client disconnect and cleanup, and the WebSocket chat.
<!-- SECTION:FINAL_SUMMARY:END -->
