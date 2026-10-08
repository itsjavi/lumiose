---
id: TASK-18
title: 'Implement hydration, the island loader and island records'
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 20:58'
labels: []
milestone: m-2
dependencies:
  - TASK-47
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Server-first islands need a small loader and a positional hydration protocol that never refetches awaited data (decision-9, spec §7.2, §7.4).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The hydrate walk claims nodes positionally, with per-async-instance ranges and replay of await records keyed by (instancePath, site, occurrence)
- [x] #2 Loader ≤1 kB: records appended across chunks, TreeWalker discovery, load/idle/visible/media/only triggers, event capture and replay, slot templates
- [x] #3 An end-to-end browser test: SSR page → islands hydrate → no refetch; a mismatch falls back to a client render (LUM4006 in dev)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Spark (TASK-18 plan):
1. Cursor (dom/hydrate.ts): per-run claim stack of "holes" (server node runs, blocks/slots collapsed to their opening comment). template() claims the next entry and walks template content vs server nodes side by side: removes <!--!-->, turns each server block into a hole keyed by (parent, client marker) (a <!> placeholder keeps the block close as the marker), creates text nodes for empty text() holes, fails on tag mismatch. Holes are pushed in reverse so eager values (createComponent as an insert argument) claim from the next hole.
2. Runtime hooks (dom/insert, list, async, boundaries, frame, hydration): region() opens a hole by key and end() closes it after the first render; createRange(mode) claims the next server block for branchValue/listValue/Suspense/ErrorBoundary ranges (mode 3: the rest of the region, for Suspense/ErrorBoundary content); async instances fork a cursor for their first run, carried by the run frame (setFrame installs it), so continuations claim from their own block. Suspense keeps server content while hydrating instead of flashing the fallback; a [! ErrorBoundary block renders fresh.
3. hydrate(C, props, start, end, awaits?, slots?, fresh?): island root region, slot getters (inline slots adopted, <template data-l-slot> inserted later), await replay by instancePath:site:occurrence (decodeData), mismatch -> dispose, clear range, client render with replay + LUM4006 in dev.
4. Loader (dom/islands.ts logic + dom/loader.ts entry importing virtual:lumen/islands): MutationObserver for data-l-islands scripts (incl. appended await records), one TreeWalker pass per new batch, triggers load/idle/visible/media/only, waits for streamed placeholders inside the range, capture+replay of click/input/submit/keydown.
5. Tests: happy-dom unit tests (cursor walk, regions, async replay, Suspense, slots, mismatch); e2e fixture (Vite middleware SSR server + Playwright, Chromium) for no refetch, state, early click replay, visible trigger, streamed Suspense, slots, mismatch fallback.
6. Size report incl. loader+hydrate and typical app with hydration; notes for Nova (headAssets/build entry), Lux (package export ./dom/loader, doc-2), Beacon (docs).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (from TASK-16), slot protocol change (server side done by Nova, client by Spark):
- Slots rendered during SSR are emitted inline only, wrapped as <!--l:s:name-->…<!--/l:s-->, and the client adopts those nodes.
- <template data-l-slot> is emitted only for slots that were not rendered during SSR.
- Text separators: adjacent dynamic texts get <!--!-->. A dynamic text next to static text gets no separator, and an empty dynamic text produces no text node. The hydrate walk must create a text node in that case.
- Agree the details with Photon's TASK-14 output.

Nova (from TASK-24): lumen dev adds <head> assets in packages/lumen/src/app/dev/plugin.ts headAssets() (Vite client + linked stylesheets); add the island loader client entry there (one line) when it exists. In dev, island module URLs are Vite import URLs: moduleUrl('/src/X.stsx') = '/src/X.stsx?import' (non-JS extensions get ?import, as import analysis writes them), so the loader should import through virtual:lumen/islands (Photon's manifest) and never build URLs from bare specifiers.

Lux: doc-2 §3.1 now holds the full hydration marker table (Nova, TASK-47). Also from Nova and Photon:
- Add the island loader to headAssets().
- Dev island URLs are /src/X.stsx?import.
- The loader imports virtual:lumen/islands; its keys equal the record refs.
- Walk template content and server nodes side by side.
- Create text nodes for empty text() holes.

Lux (from TASK-12 and TASK-49):
- Parentless branchValue/listValue ranges must adopt the server <!--[-->…<!--]--> regions under hydration.
- Size: all exports measure 9.48 kB against the 10 kB hard cap. Keep hydration and the loader tree-shakeable and as small as possible (soft target ≤ 1.5 kB). The cap applies to what an app actually ships; report the typical-app number with hydration included.

Spark progress: cursor + hooks + hydrate() + loader implemented (dom/hydrate.ts, dom/islands.ts, dom/loader.ts; hooks in insert/list/async/boundaries/frame/hydration). Findings so far:
- The compiled walk (firstChild/nextSibling) needs the template structure, so server content of a hole that precedes a template node (a <!> placeholder or a static marker) waits in a fragment until its region opens; append holes stay in place. Focus is restored after the pass.
- Replay skipped the await expression, so its reactive reads (props.id in fetchJSON(`/api/${props.id}`)) were not tracked and hydrated async components never re-ran. Replay now evaluates the expression for tracking with fetch held off (pending promise) and drops its result.
- The cursor install moved behind a frame hook set by lumen/dom/hydrate, so apps without hydration tree-shake every claiming path again (typical imports back to 6.02 kB).
- Server side of TASK-50 (branch()/list() in value positions) noted on TASK-50 for Photon; until then parentless values in islands fall back (LUM4006).

Nova (TASK-71) touched packages/lumen/src/server/frame.ts runComponent only (your runAsync/block/inAsyncRun hunks untouched): sync components now run under core's runWithLazyOwner (owner materialized on first getOwner/provide/onCleanup/lifetime), with component/props passed via module slots (runNext). Also server/node.ts escaping now emits only &amp; &lt; in text and &amp; &quot; in attributes (DOM-identical). Your hydrate tests pass with these changes.

RESUME (Spark, checkpoint 2026-10-08, session spark-task18-20261008T161236Z):
DONE (uncommitted, typecheck + lint clean for my files; lumen dom/core/server vitest 367/367 green at last run):
- packages/lumen/src/dom/hydrate.ts (cursor, hydrate(C, props, start, end, awaits?, slots?, fresh?), slots, replay with tracking, mismatch fallback + LUM4006), dom/islands.ts (loadIslands(manifest): records/MutationObserver, TreeWalker, load/idle/visible/media/only, streamed-placeholder wait, event capture+replay), dom/loader.ts (entry: imports virtual:lumen/islands), dom/virtual.d.ts.
- Hooks: dom/hydration.ts (Hydrator: template/region/end/branch/range/fork), frame.ts (Frame.h, setFrameHook, withIsland(replay, h, fn), AwaitReplay(key, thunk)), insert.ts (createRange(mode), renderRange(value, mode), end() after insert/branch, branch side check, branchValue mode 1), list.ts (end, listValue mode 1, in-place rows), async.ts (fork, show() with frame), boundaries.ts (Suspense createRange(1)+content mode 3, cond = show content, no fallback while hydrating; ErrorBoundary mode 2/3). Tests: dom/hydrate.test.ts (12, compiler-backed), hydration.test.ts/async.test.ts updated. scripts/size.ts: islands rows.
- Size: typical 6.02 kB; typical+loader+hydrate 8.61 kB (< 10 kB cap); increment 2.60 kB brotli (> 1.5 kB soft target); every export 9.53 kB.
IN PROGRESS: e2e fixture examples/islands-e2e (package.json, vite.config.ts, tsconfig.json, server.ts, playwright.config.ts, src/{api.ts,Counter.stsx,Team.stsx,Greeting.stsx,Page.tsx,entry-server.tsx}); deps installed (lockfile has the importer). Not yet run.
NEXT: 1) write e2e/islands.e2e.ts (gate loader route, tag server nodes, assert claimed + 0 /api requests; Select → 1 fetch; Extra → template slot; early clicks replayed via gated Counter module; visible counter gets data-hydrated only after scroll; /?mismatch → LUM4006 console warning + working island); 2) `pnpm --filter @lumen-examples/islands-e2e test:e2e`; check Greeting root ternary compiles without branchValue (else adjust); 3) optional size trims; 4) notes for Nova (headAssets: `<script type="module" async src="/@fs<abs>/packages/lumen/src/dom/loader.ts">` in dev; build: loader.ts as client entry instead of the bare manifest), Lux (package export "./dom/loader", doc-2 §1/§3.1 hydrate signature + range modes, new examples/islands-e2e dir ownership), Beacon (docs reference/dom.md hydrate + loader, LUM4006 "Reported by"); 5) ACs, final summary, Done.
KNOWN: TASK-50 server side must emit branch()/list() in value positions (note left on TASK-50); until then compiled parentless values in islands fall back (LUM4006). Multi-root fragments mixing template roots with dynamic children mismatch (consecutive claims only).

Spark (session spark-20261008T203611Z, resumed; solo on TASK-18):
- E2E done: examples/islands-e2e/e2e/islands.e2e.ts, 5 Playwright tests in Chromium 153 against the fixture's Vite middleware-mode SSR server (renderToStream + islandUrl, loader as <script type=module async src=/@fs/…/dom/loader.ts>): (1) loader held until the stream ended, server nodes tagged → after hydration every island element and non-empty text is the server's (counter, Team, async members, streamed Suspense content, inline children slot, Greeting), 0 /api requests, counter state, Select → exactly one /api/member/bob (tracked reads in replayed awaits), Extra → template slot inserted/removed, no console errors; (2) /?slow=2500: Counter hydrates while the stream is open, Team waits for its streamed Suspense content and hydrates after it with 0 /api requests; (3) client:visible hydrates only after scrolling; (4) Counter module held → 2 early clicks replayed (3 → 5); (5) /?mismatch → exactly one LUM4006 (Greeting), client render works, other islands unaffected.
- BUG found by e2e and fixed (dom/islands.ts streaming()): Chromium 153 parses <?start name=…>/<?end> as ProcessingInstruction nodes (declarative partial updates; <template for> is applied natively, $swap finds no template). The loader only looked for '?start' comments, so Team hydrated over the fallback → LUM4006 + refetch. Now walks SHOW_COMMENT|SHOW_PROCESSING_INSTRUCTION (target 'start' or comment '?start'). Unit test added (hydrate.test.ts: PI placeholders + emulated native patching; fails without the fix). Also contains() no longer throws when an unhydrated island's range left the document.
- Fixture: typecheck script (lumen check, shadow rootDirs), ?slow= delay knob (api.ts delays + server.ts), Team slot props typed JSX.Element.
- Size (pnpm --filter lumen size; new row splits hydrate/loader): typical 6.02 kB; typical+loader+hydrate 8.68 kB (cap 10 kB OK); islands increment 2.66 kB (soft 1.5 kB OVER) = hydrate 1.92 kB + loader 0.74 kB (AC #2 ≤1 kB OK).
- Not done here (owners): lumen dev/build loader wiring is Nova's (in progress in the working tree: loaderUrl in renderToStream/createServerRenderer, \0lumen:loader virtual module, BuiltApp.loader); once it lands the fixture can pass loaderUrl instead of writing the script itself. Lux: package export ./dom/loader, doc-2 §1/§3.1 (hydrate signature, range modes), islands-e2e ownership → Spark. Beacon: docs reference/dom.md (hydrate, loader, triggers, event replay), LUM4006 'Reported by' (hydrate mismatch + missing await record).

Spark: committed as 88f71d4.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hydration and the island loader are complete and verified end to end.
- Runtime: positional claim cursor (dom/hydrate.ts, dom/hydration.ts hooks in insert/list/async/boundaries/frame), per-async-instance ranges, await replay keyed by instancePath:site:occurrence with tracked reads, slots (inline adopted, <template data-l-slot> on demand), mismatch → client render + LUM4006 in dev.
- Loader (dom/islands.ts, entry dom/loader.ts): records across chunks via MutationObserver, one TreeWalker pass per batch, load/idle/visible/media/only, waits for streamed Suspense content (comment or processing-instruction placeholders), click/input/submit/keydown capture + replay. 0.74 kB brotli on top of an app; hydrate 1.92 kB; typical app with islands 8.68 kB (< 10 kB cap; 1.5 kB soft target for both together exceeded at 2.66 kB).
- Evidence: 13 happy-dom tests (packages/lumen/src/dom/hydrate.test.ts) and 5 Playwright tests (examples/islands-e2e, pnpm --filter @lumen-examples/islands-e2e test:e2e): no refetch, node identity kept, state, streamed Suspense, visible trigger, early-click replay, mismatch fallback. The e2e found and fixed a Chromium 153 issue (<?start> parsed as a processing instruction).
- Follow-ups: Nova's lumen dev/build loader wiring (loaderUrl, in progress), Lux's ./dom/loader export + doc-2, Beacon's docs (see notes).
<!-- SECTION:FINAL_SUMMARY:END -->
