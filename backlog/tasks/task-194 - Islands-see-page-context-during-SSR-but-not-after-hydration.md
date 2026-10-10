---
id: TASK-194
title: Islands see page context during SSR but not after hydration
status: Done
assignee:
  - Nova
created_date: '2026-10-10 03:33'
updated_date: '2026-10-10 03:46'
labels:
  - bug
  - islands
dependencies: []
priority: medium
ordinal: 194000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found 2026-10-10 (TASK-189). On the server an island renders under the page's owner (runComponent in src/server/frame.ts via island() in src/server/island.ts), so inject() sees context the page provided; in the browser hydrate() creates the island under createOwner(undefined) (src/dom/hydrate.ts), so inject() returns the default. Result: island HTML and hydrated state disagree. The fix must keep the internal contexts islands rely on during SSR (Suspense boundary, error handling, request). Options: hide user contexts from islands during SSR, and/or a dev diagnostic when an island injects a value provided outside it. Documented today as a common mistake in docs/concepts/state.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An island's inject() gives the same result on the server and after hydration; Suspense, error boundaries and request APIs inside islands still work
- [x] #2 Dev diagnostic (registry code) when an island reads a context provided outside it, if that is the chosen fix; regression tests on both sides
- [x] #3 Docs updated (islands and Sharing state pages)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-10): Mechanism: the server renders each island under an isolated owner (new ISOLATED owner state bit, isolateOwner() in core/owner.ts). Public inject() (injectUserContext) stops at an isolated owner; internal lookups (injectContext/lookupContext: Suspense/route/error handler keys) pass it. The island owner stays a child of the call site's owner, so lifetime(), onCleanup, head depth and render disposal still follow the page; server Suspense/ErrorBoundary use the frame and request APIs use AsyncLocalStorage, so they are unaffected. Slots are rendered at the call site and keep seeing the page's context (they are static page HTML on both sides). Chosen over a fresh root owner + re-providing internals: no internal context needs re-providing, depth/disposal stay correct, and the dev check can look past the barrier. Client hydrate() unchanged (already a root). Dev diagnostic LUM4010 (registry entry added in crates/lumiose_compiler registry.rs, docs/errors/LUM4010.md): warned once per island ref per process when inject() stops at the island root and an owner above provides the key; cost is only on misses inside islands in dev. Tests: server/island.test.ts (default/own value, async island, slots, LUM4010 once, Suspense+ErrorBoundary+locals()+cleanup inside an island) and dom/hydrate.test.ts (page provides, island hydrates without LUM4006 and stays interactive). Validation: pnpm typecheck, pnpm lint (no new warnings), pnpm --filter lumiose test 715/715, pnpm test 1438 passed (1 cli help test timed out under load, passes alone), docs:check green, cargo registry tests, examples/islands-e2e Playwright 5/5. Commit dfc1f41. docs/llms-full.txt left uncommitted: it also carries Spark's in-progress state.md/reactivity.md changes; Lux regenerates/commits it. Lux applies the state.md common-mistake replacement text.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Islands now render on the server under an isolated owner, so inject() inside an island sees only the context's default or values provided inside the island, as after hydration (no more HTML/hydration disagreement). Internal contexts, Suspense, ErrorBoundary, request APIs, lifetime() and cleanups keep working inside islands. Dev warns LUM4010 when an island injects a context the page provided. Docs: islands page (concept + common mistake + related diagnostic), new LUM4010 page; the Sharing state page note is applied by Lux. Commit dfc1f41.
<!-- SECTION:FINAL_SUMMARY:END -->
