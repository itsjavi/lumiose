---
id: TASK-193
title: 'Scoped state: one instance per request, shared by islands, sent to the browser'
status: Done
assignee:
  - Spark
created_date: '2026-10-10 03:33'
updated_date: '2026-10-10 19:26'
labels:
  - state
  - core
  - islands
dependencies:
  - TASK-190
priority: medium
ordinal: 193000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
doc-6 §A, decision-33. A factory-defined state that runs lazily once per scope: per request on the server, once per page in the browser (shared by islands and the SPA tree), fresh per test. Seeded by its factory from request APIs; states instantiated during the request and reachable from client code are serialized once per page (compiler-assigned id, existing serializer), streamed with their chunk, and restored before islands hydrate. Name provisional until TASK-190. Touches core/dom (Spark), src/server serialization (Nova's area) and the compiler id (Photon): Lux coordinates the cross-area edits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Server: one instance per request, never shared across requests; browser: one per page, the same instance in every island
- [x] #2 Server values restored before hydration with no mismatch; only client-reachable states are sent; plain-data rule enforced with a diagnostic
- [x] #3 Streaming: a state first used in a late boundary arrives with that chunk; tests cover SSR, hydration, islands, SPA and per-test isolation
- [x] #4 Docs: Sharing state page and reference updated (security note: sent state is public); LUM4008 guidance points to it
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Design (Spark, 2026-10-10):
1. Core (browser, src/core/state.ts): defineState(factory) returns an accessor; the factory runs on first call, untracked and ownerless (page scope), once per page. A generation counter (resetStates, internal) makes instances stale for per-test freshness; a restore hook (internal) lets the hydration path write server values into a new instance.
2. Server (src/server/state.ts): one AsyncLocalStorage state scope per request (entered by runInRequestScope) or per render (renderShell creates one when none is active). The factory runs under the render's root owner. Outside any scope it throws, except in tests (after resetStates ran, a test fallback scope is used, reset per test).
3. Ids: the Vite plugin (new lumiose:state transform, after TS stripping/compilation, only for modules that contain 'defineState') appends <binding>.$$id = "<module>#<export>" for module-scope defineState(...) bindings imported from lumiose. Module ids follow island refs (root/package-relative).
4. Reachability: client environment records every id it assigns (client graph by construction). Server build assigns ids only to recorded refs (client builds first). Dev: the server transform assigns ids to every state outside server-only modules, and lumiose dev passes an isClientState predicate: the state's module reaches an island module or an SPA route module through the ssr module graph (importers). States without an id are never sent.
5. Payload: at each flush (shell, then each streamed boundary), states instantiated so far and not yet sent, with an id, go out as <script type="application/json" data-l-payload>{"s":{ref:{member:value}}}</script> before the island records (encodeData + jsonForScript). Only when the page has islands. Members: the returned signal/store itself (key "") or the returned object's top-level signals and stores. Non-plain values throw LUM4011 (new registry code) with the path.
6. Browser restore (src/dom/state.ts, hydration path): the island loader (and the CSR SPA start) reads payload scripts before the records of the same chunk; values wait until the state is created (restore hook) or, if it already exists, are written in at once (batched). Signals via set, stores by replacing their keys.
7. Tests: core/server/dom units, compile-both-targets SSR+hydration tests (islands, streamed boundary, SPA root island), Vite transform unit tests, per-test isolation via a Vitest setup file the plugin adds under Vitest (beforeEach resetStates).
8. Docs: concepts/state.md, reference/reactivity.md, LUM4008/LUM4010/LUM4011, testing and security notes; docs:gen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-10 Name approved (decision-35): defineState(factory) returns an accessor (no use prefix).

2026-10-10 Spark (worker, Lux holds the claim): implemented.

Design as built:
- Scope: browser core (src/core/state.ts) caches the instance in the accessor's closure, keyed by a generation counter; the factory runs untracked under no owner. Server (src/server/state.ts): one AsyncLocalStorage state scope per request (runInRequestScope enters it, so middleware, endpoints, actions and the render share instances) or per render (renderShell creates one outside a request); the factory runs under the render's root owner; outside any scope the accessor throws, except in tests: once resetStates() ran, code outside a request/render shares one scope per test. No new public API beyond defineState.
- Tests: @lumiose/vite adds a Vitest setup file (packages/vite/src/vitest-setup.ts) under VITEST that calls resetStates() (lumiose/internal/core/state.ts) before each test; it bumps the generation, which makes browser instances and the server test scope fresh.
- Ids: new lumiose:state plugin (packages/vite/src/states.ts), a normal-order transform (after TS strip and the Lumiose compile) filtered on code containing defineState. For module-scope const x = defineState(...) bindings with defineState imported from lumiose it appends x.$$id = "<module>#<export>" at the end of the module (map: null, no code moves). Module ids match island refs (root/package-relative). No Rust change was needed: .ts modules never reach the Rust compiler.
- Reachability: the client environment records every ref it assigns (client graph by construction). Server build: ids only for refs the client build recorded (it builds first, sharedDuringBuild). Dev: the server compile ids every state and records its file; lumiose dev passes isClientState to createServerRenderer, backed by api.isClientState(ref, spaRoutes): upward walk over the ssr module graph importers from the state's module to an island module (island registry) or an SPA page/layout file. Reachability is global (a state an island anywhere imports is sent on every page that created it), as in the build.
- Payload: <script type="application/json" data-l-payload>{"s":{"<ref>":{"<member>":value}}}</script> before the island records of the shell and of each streamed chunk; it carries the states created so far and not yet sent by this render, once the page has islands (from the first chunk with island records on). Members: "" for a returned signal/store, else the returned object's top-level signals (duck-typed set+peek) and stores (server store() marks plain objects in a WeakSet). Encoded with encodeData + jsonForScript (island-prop rules). Non-plain data: LumioseError LUM4011 (new registry code), with the value path; the shell rejects, a boundary keeps its fallback and reports to onError.
- Restore: src/dom/state.ts (hydration path). The loader scans data-l-payload and data-l-islands scripts in document order; values wait in pending until the state's factory runs (restore hook set via setStateRestore), then signals get set() and stores have their keys replaced, untracked and batched; a state that already exists when its values arrive (late chunk) gets them at once. CSR SPA start (csr.ts) reads payloads before its first render. SSR'd SPA roots are islands (same path).
- Moved RenderToStreamOptions/RenderedShell to src/server/render-types.ts so the browser entry's type graph does not load server/state.ts (node:async_hooks).

Limitations / follow-ups:
- Factories that read request APIs must guard them (import.meta.env.SSR ? cookies().get(...) : ...), since the factory also runs in the browser where they throw LUM4003. Documented; a nicer DX would need a user decision.
- States in dependencies that Vite externalizes (SSR) or pre-bundles (client) get no id. States created inside functions get no id (never sent). Only direct imports of defineState from lumiose are recognised.
- The Vitest setup file resets the lumiose instance @lumiose/vite resolves; with mismatched lumiose versions it would reset another copy. Setup files outside Vite's fs.allow (a temp fixture linking the repo) need server.fs.strict false; real installs are inside the root/workspace.
- Size: core + dom (every export) 10270 B before this task (already over the 10240 B cap), 10321 B after (+51 B). See the final summary.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
defineState(factory) ships (commits ac9b4ce, 4f1218f). One instance per request on the server (AsyncLocalStorage scope per request, or per render outside one), one per page in the browser shared by every island and the SPA tree, fresh per test (Vitest setup added by @lumiose/vite). @lumiose/vite appends <binding>.$$id = "<module>#<export>" to module-scope states: the client environment records them, the server build keeps only recorded ones, and lumiose dev checks reachability through the ssr module graph (isClientState). The renderer sends the states created so far in a data-l-payload script before each chunk's island records (shell and streamed boundaries), once the page has islands; values follow the island-prop rules, with the new LUM4011 for non-plain data. The loader and the CSR start restore them before islands read the state; hydration produces no LUM4006.

Tests: core (scope, reset, untracked/ownerless factory), server (per-request isolation under concurrency, render scope, payload contents and order, no id / rejected / no islands, streamed boundary, LUM4011 in shell and boundary, test scope), compile-both-targets hydration (two islands sharing a restored state with no mismatch, state first used in a streamed boundary, late values), CSR SPA payload, Vite transform/registry units, lumiose dev e2e and lumiose build e2e (only the island-reached state is sent), Vitest fixture (per-test reset in DOM and server tests). Validation: pnpm typecheck OK; lumiose 752 tests, vite 124, compiler 45, cli 94 passed; cargo test --workspace OK (napi rebuilt); pnpm lint 0 errors; docs:gen/docs:check and docs examples OK.

Docs: Sharing state (scoped state section, recipe, security note: sent state is public), defineState reference, islands, security, testing, @lumiose/vite reference, LUM4011 page, LUM4008 and LUM4010 point to defineState.

Size (user cap, red as agreed): core + dom (every export) 10.08 kB brotli = 10321 B, cap 10240 B; it was already 10270 B before this task, so defineState adds 51 B. Tried: instance on accessor properties (+15 B), restore hook shapes (adopted the optional hook, -29 B); a plain-Error production stub instead of LumioseError in dom/public.ts would save 51 B (back to 10270 B, still over) but changes the error shape, so not applied. Hydration path: islands on top of typical 2.87 kB (soft target 2.75 kB, was 2.74), loader 0.93 kB (target 1.00 kB OK). Lux to raise the cap (user allows up to 12 kB).

Follow-ups: request APIs in a factory need an import.meta.env.SSR guard in the browser (DX question for the user); TASK-195 can add its cached results to the same payload (a new key next to s, keyed by its hash, restored on the same document-order scan); optional e2e in examples/islands-e2e; decision on lumiose being a peer of @lumiose/vite (Vitest setup resets the copy @lumiose/vite resolves).
<!-- SECTION:FINAL_SUMMARY:END -->
