---
id: TASK-16
title: 'Implement the server runtime: shell, Suspense streaming and head'
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 13:26'
labels: []
milestone: m-2
dependencies:
  - TASK-7
  - TASK-6
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-19 requires holding the shell until all non-Suspense content resolves, then streaming boundaries out of order, with correct status, redirects and head handling.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 renderToStream/renderToString implement the shell-first model; boundaries stream via <template for> with a $swap fallback; SSG renders fully resolved
- [x] #2 Context frames, request-scoped accessors, Head/Title/Meta collection, ErrorBoundary on the server, LUM5004
- [x] #3 Data-only serialization (JSON / seroval JSON mode) for island props and await records; tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: reassigned from Spark to Nova to balance load. Nova owns the server half of the request pipeline, and Spark keeps core/dom/client async. Requirements carried over from TASK-22:
- renderToStream(root, { signal?, resolveAll? }) resolves when the shell is ready and returns { head, body, stream | null }.
- It rejects with the first thrown shell value, unwrapped.
- It reads the request through the app layer's getRequestScope(); do not duplicate the accessors.
- It uses the server core variant (packages/lumen/src/core/server.ts from TASK-7).

Nova: started (session nova-task16-20261008T131130Z). Plan: src/server/{node,escape,frame,ssr,components,island,serialize,render}.ts; index.ts = ServerRuntime + renderToStream/renderToString; public.ts = core server + render APIs + Suspense/ErrorBoundary/Head/Title/Meta. Then TASK-22 integration (createServerRenderer, document through createComponent).

Nova: implemented lumen/server in packages/lumen/src/server/ (node.ts, frame.ts, ssr.ts, attrs.ts, components.ts, island.ts, serialize.ts, render.ts; index.ts = every ServerRuntime member + renderToStream/renderToString, compile-time `satisfies ServerRuntime` in contract.test.ts; public.ts = core server variant + renderToStream/renderToString + Suspense/ErrorBoundary/Head/Title/Meta).

Design
- Hole protocol: string holes are HTML already produced by a helper (attr/classAttr/styleAttr/spreadAttrs/escape/text/insert); rendered HTML is a branded `SSRHtml` instance ({ t }), so user objects shaped like { t } are escaped, never trusted. Content positions (insert, component results, children) escape plain strings. ssr() is sync-first; thenable holes resolve concurrently, order preserved, rejecting with the first rejection.
- Frames: each component instance gets an owner (core owners, so provide/inject/onCleanup/lifetime work) plus a frame { render, unit, island, path, children, occurrences, streamed }. Outside islands frames are shared; inside islands each instance gets path parent.N. Async components (instanceof AsyncFunction) run as runs: $await evaluates the thunk in the run, pauses it, and resolves to a resume function; rejections also resolve to a function that resumes and then throws, so catch blocks run with context restored. $leave pauses. Two interleaved renders keep separate context (tested).
- Markers only inside islands: insert <!--[-->…<!--]-->, list <!--[-->rows<!--]-->, branch <!--[-->…<!--]--> / <!--[!-->else<!--]-->, text: <!--!--> between two text() holes separated by an empty static part.
- Shell-first: renderToStream(root, { signal, resolveAll, nonce, strictStyles, islandUrl, onError }) resolves { head, body, stream | null } once everything outside <Suspense> resolved; rejects with the first thrown value unwrapped (Redirect/HttpError survive). Root owner disposed at the end (cleanups run, lifetime() aborts); abort before the shell rejects with the reason, after it ends the stream quietly.
- Suspense (streaming): sync content renders inline; async → shell gets <?start name="lbN">fallback<?end>, chunk = [modulepreload links][<style nonce>][<template for="lbN">HTML</template><script nonce>$swap("lbN")</script>][records]; first chunk starts with <script>$swap=…</script> (430 B raw, 246 B brotli; no-op when the browser applied <template for> natively; handles nested ranges; removes markers). Nested boundaries flush after their parent. Inside a streamed boundary everything is isolated: errors go to an inner ErrorBoundary, else onError (fallback stays, other boundaries continue); redirect()/notFound()/error() become LUM5004 (cause = original); <Title>/<Meta>/<Head> inside <Suspense> throw LUM5004 in streaming mode (deterministic, independent of timing). resolveAll: Suspense is transparent, no fallbacks/stream/swap.
- ErrorBoundary: fallback (content or (error, reset) => content) in place for sync throws and rejections; Redirect/HttpError pass through in the shell.
- Head: deepest <Title> wins (owner depth); <Meta> dedupes by charset/name/property/http-equiv/itemprop (deepest wins); <Head> appends; head = title + metas + Head content + shell modulepreloads + strict styles.
- Islands: <!--l:ID--><template data-l-slot="name">slot</template>…island…<!--/l:ID-->; client:only renders slots only; slots render in the call-site frame and the island reads them inline too; nested islands inside an island's render are inline without a record. Records per flushed chunk: <script type="application/json" data-l-islands>[{ id, ref, strategy, props, value?, slots?, awaits? }]</script> ("<" escaped); awaits recorded under instancePath:site:occurrence; awaits of a boundary inside an island are appended in that boundary's chunk as { id, awaits }. client:load adds a modulepreload hint (head for the shell, inline in chunks), URL via islandUrl. LUM4002 (props) and LUM4007 (awaited values) name the path, e.g. Island prop "user.save" of <Panel client:visible> (/src/X.stsx#Panel) is a function.
- Serialization (decision recorded here): strict data-only JSON with "$"-tagged values for undefined (array items/top level), NaN/±Infinity/-0, BigInt, Date, URL, Map, Set, and escaped objects that have a "$" key; undefined object properties omitted; functions, symbols, class instances, promises and cycles rejected with a path; "__proto__" kept as data. decodeData() is isomorphic and dependency-free for the island loader (TASK-18). seroval not added; revisit if richer types are needed.
- CSP strict: styleAttr emits data-l-v="N" and a [data-l-v="N"]{…} rule (braces and < escaped) in a nonce'd <style>.
- Request scope: nothing duplicated; accessors come from app/server/scope.ts via AsyncLocalStorage, which follows streamed boundaries (e2e-tested with url() inside a boundary).

Validation: pnpm typecheck OK; pnpm lint: no warnings/errors in src/server or src/app/server; pnpm test 395/395 (src/server: 61 tests — contract 2, ssr/helpers + golden 5.1-5.4 18, render/streaming/ErrorBoundary/head/context 21, islands/await records + golden 5.5 11, serialization 6, $swap in happy-dom 3).

Open items for Lux/Spark/Photon (in the report): $await rejection shape on the client; text adjacent to static text inside islands; empty dynamic text; slot HTML duplication (template + inline); browser `lumen` entry lacks Suspense/ErrorBoundary/Head/Title/Meta/renderToStream/renderToString (TASK-17); LUM4008 belongs to the core server signals.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen/server implements the full ServerRuntime contract (checked at compile time) plus shell-first renderToStream/renderToString, Suspense out-of-order streaming via <template for> + <?start>/<?end> with a once-per-response $swap fallback, ErrorBoundary, Head/Title/Meta, islands with markers/slots/records/await replay keys, data-only tagged-JSON serialization with LUM4002/LUM4007 paths, LUM5004 inside streamed boundaries, CSP nonce and strict styles. 61 runtime tests + 7 end-to-end handler tests (TASK-22).
<!-- SECTION:FINAL_SUMMARY:END -->
