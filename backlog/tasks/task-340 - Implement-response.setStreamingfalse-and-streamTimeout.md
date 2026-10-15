---
id: TASK-340
title: Implement response().setStreaming(false) and streamTimeout
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-15 07:41'
updated_date: '2026-10-15 08:25'
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
- [x] #1 response().setStreaming(false) before the shell sends one fully resolved document; after the shell it is LUM5004
- [x] #2 streamTimeout defaults to 30 s, accepts a duration or false, and a boundary pending past it renders its ErrorBoundary and reaches onRequestError with phase stream
- [x] #3 Prerendering ignores streamTimeout
- [x] #4 Tests cover both in dev, preview and the Node adapter
- [x] #5 concepts/server.md, concepts/rendering-modes.md, reference/vite.md and reference/app.md describe them, with the crawler recipe
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-15): claimed in worktree branch claude/nova-m11-e57655.

Nova (2026-10-15), implementation:
- `response().setStreaming(streaming)` on ResponseContext (src/app/server/scope.ts): writable until the shell is sent, LUM5004 after ("Cannot change streaming after the shell was sent"). The renderer reads it live through a new internal `streaming()` shell option (src/server/render.ts, frame.ts `resolvesAll()`): set in middleware, every `<Suspense>` renders transparently as when prerendering; set in a page while it renders, later boundaries are transparent and boundaries already streaming are awaited and spliced in place of their `<?start name="lbN">…<?end>` ranges (their islands, styles, preloads folded into the shell as for a synchronous boundary; a failed one keeps its fallback). Such boundaries still count as streamed for head/status/redirect (LUM5004), documented. Error pages of the request keep the flag (createResponseState carries it).
- `lumiose({ streamTimeout })` (src/app/server/stream-timeout.ts `resolveStreamTimeout`): milliseconds or "500ms"/"30s"/"2m", default 30 s, false disables, > 2^31-1 ms refused (setTimeout limit). Validated in packages/vite/src/options.ts; passed to the handler by the dev plugin, and to the server entry config (BuiltApp.streamTimeout) for preview, adapter-node and the deploy adapters. The handler passes it only when not prerendering (static routes in dev included); renderShell also ignores it with resolveAll.
- Timeout semantics, two phases so the NEAREST ErrorBoundary wins: when it expires, every async component run still pending rejects with LUM5009 (raced in runAsync, i.e. where the render waits; composite promises are not raced, otherwise an outer ErrorBoundary could win the same tick); a task later, boundary contents still pending (e.g. a raw promise in content position) fail: a streamed boundary keeps its fallback (onError phase "stream"), a transparent one rejects into its parent. The stream then ends. The timer starts lazily at the first async work of a render (sync pages pay nothing), is unref()ed, and is cleared when the render ends. Each failure gets its own error object (digests stay distinct).
- New diagnostic LUM5009 "Boundary still pending when streamTimeout expired" (error): one line in crates/lumiose_compiler/src/diagnostics/registry.rs (Photon area, same precedent as LUM5008 in TASK-294), docs/errors/LUM5009.md written. ErrorBoundary fallbacks get the usual generic error + digest in production.
- Tests: src/server/streaming.test.ts (renderer: off from the start, switched mid-render with nested and styled boundaries, failed boundary, abort while waiting, nearest ErrorBoundary, late failure, transparent timeout, ignored with resolveAll, timer cleared), src/app/server/stream-timeout.test.ts (option parsing, middleware/page/error page, LUM5004 after the shell, onRequestError phase stream, prerender ignores it), packages/vite/src/options.test.ts, and one shared fixture (packages/vite/src/app/__fixtures__/streaming.ts) checked under lumiose dev (dev-server.test.ts), lumiose preview (command.test.ts) and @lumiose/adapter-node (server.test.ts).
- Docs: concepts/rendering-modes.md (how pages render: timeout, one resolved document), concepts/server.md (### Crawlers get one resolved document: the isbot middleware recipe; response() table), reference/vite.md (streamTimeout), reference/app.md (ResponseContext.setStreaming), errors LUM5004 (lists setStreaming) and LUM5009.
- Performance: no claim. The SSR benchmark renders a sync page with renderToString, which never starts the timer; per request, async components pay one Promise.race while the timeout is on.
- Small edit in packages/vite/src/app/dev/plugin.ts (one line passing streamTimeout), next to Spark's TASK-341 work.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
response().setStreaming(false) sends one fully resolved document (from middleware, or from a page while it renders: boundaries already streaming are inlined), LUM5004 after the shell. lumiose({ streamTimeout }) takes milliseconds or "30s"/"500ms"/"2m", default 30 s, false disables: when it expires, pending async components fail with the new LUM5009 into the nearest ErrorBoundary, boundaries still pending keep their fallback, onRequestError gets phase stream, and the response ends; prerendering ignores it. Tested in the renderer, the handler, lumiose dev, lumiose preview and @lumiose/adapter-node; docs with the isbot crawler recipe.
<!-- SECTION:FINAL_SUMMARY:END -->
