---
id: TASK-47
title: 'Server-side hydration markers, slot dedup and fetchJSON lifetime default'
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-08 14:02'
updated_date: '2026-10-08 15:52'
labels: []
milestone: m-2
dependencies:
  - TASK-17
priority: high
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Client hydration (TASK-18) needs the server output inside islands to delimit every claimable range, and Spark/Nova agreed protocol refinements during TASK-16/17.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Inside islands, the server wraps every async component instance, Suspense range and ErrorBoundary range in block markers matching the client's range model (dom/async.ts), with await records keyed like the client's instance paths (dom/frame.ts)
- [ ] #2 Slots rendered during SSR are emitted inline as <!--l:s:name-->…<!--/l:s--> only; <template data-l-slot> only for slots not rendered during SSR (TASK-18 notes)
- [ ] #3 fetchJSON defaults its abort signal to lifetime() when called inside an async component run, so superseded runs cancel their fetches
- [ ] #4 Server tests updated; the marker format is documented in contract doc-2 §3 (propose the text to Lux)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Async instances inside islands: wrap each instance's output in a block (server frame.ts runAsync), matching the client's createAsync range.
2. Suspense / ErrorBoundary inside islands: one block per boundary (around content or the streamed placeholder; failed ErrorBoundary opens with [!).
3. Slots: inline <!--l:s:name-->…<!--/l:s--> where the island reads the slot; templates only for unread slots, placed after <!--l:ID-->.
4. fetchJSON: default signal = lifetime() inside async runs (client: isRun(activeSub) -> run lifetime; server: inAsyncRun() -> render lifetime).
5. Tests (server island, compiler server test expectation, client + server fetchJSON) and the doc-2 §3 text proposal.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (TASK-47):
- Server runtime: frame.ts runAsync wraps an async instance's output in <!--[-->…<!--]--> inside islands (the island root too); exports block() and inAsyncRun(). components.ts: Suspense inside islands = one block around the content, or around the streamed <?start name=lbN>fallback<?end> placeholder (the chunk's content replaces the placeholder inside the block;  ignores [ ] comments); resolveAll also wrapped. ErrorBoundary inside islands: <!--[-->children<!--]-->, or <!--[!-->fallback<!--]--> when the server rendered the fallback (client should render that boundary afresh, not claim). Nothing changes outside islands.
- Instance paths: unchanged and already equal to dom/frame.ts (island root 0, every createComponent inside numbered in creation order incl. Suspense/ErrorBoundary, continuing across awaits); await keys path:site:occurrence. Verified by tests that the fallback/children numbering matches.
- Slots (island.ts): slot HTML still renders eagerly in the call site's frame; the slot getter returns <!--l:s:name-->html<!--/l:s--> and marks the slot inline (every read is wrapped, so both sides see the same markers if read twice); after the island resolves (async roots included), slots never read become <template data-l-slot> right after <!--l:ID-->. record.slots still lists every slot. client:only: all templates.
- fetchJSON: browser variant defaults init.signal to lifetimeOf(run) when isRun(activeSub) (a superseded run cancels its fetch; signal: null or an explicit signal opts out); node variant defaults to lifetime() (the render's root) when inAsyncRun(), so an aborted render (client disconnect) cancels fetches. core/internal.ts now also exports isRun (one line in Spark's barrel).
- Touched outside my area: packages/compiler/test/server.test.ts island expectation updated to the new markers (Photon); core/internal.ts export (Spark). Docs to align (not edited): doc-1 §7.2 slot sentence, packages/lumen/docs/concepts/islands.md slot paragraph (Beacon), doc-2 §3 island row (Lux; proposal in the summary).
- Evidence: server/island.test.ts 16 tests (5 new: slot templates only for unread slots, async island slots, boundary blocks + [! fallbacks incl. async rejection, resolved/prerender + async island root, no markers outside islands; updated golden 5.5, await-record and streamed-chunk expectations); app/fetch-json.test.ts (new, happy-dom) 2 tests; app/server/fetch-json.test.ts +1; compiler server.test.ts island test green. pnpm test: all green except 3 compiler scope-token tests from Photon's in-progress TASK-45 (binding not rebuilt); typecheck clean except Photon's WIP src/vite/styles.ts; oxlint clean for my files.
<!-- SECTION:NOTES:END -->
