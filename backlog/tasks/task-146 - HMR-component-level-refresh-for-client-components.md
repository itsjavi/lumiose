---
id: TASK-146
title: 'HMR: component-level refresh for client components'
status: In Progress
assignee:
  - '@Photon'
created_date: '2026-10-09 05:24'
updated_date: '2026-10-09 14:52'
labels:
  - dev
  - hmr
dependencies: []
priority: low
ordinal: 146000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planned only (user 2026-10-09: 'plan only') — do not start without the user's go-ahead. Today an edit re-mounts the whole SPA (component state resets) or reloads SSR pages. In dev, the compiler registers each component in a hot registry and wraps its uses in a proxy; on update, only instances of the changed component are disposed and re-created in place, so parents and siblings keep their state (module-level signals already survive). Similar to solid-refresh. Dev-only; no public API.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Editing a component re-creates only its instances; sibling/parent signals and DOM state survive; works in SPA routes and islands
- [x] #2 Falls back to a re-mount/reload when a module's exports change shape; zero production cost; tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User 2026-10-09: approved (no hacks; fall back to the current reload when a change cannot be applied safely).

Spark (TASK-147 done): island hot swap re-renders whole island instances via an accept handler appended by lumen dev (app/dev/plugin.ts transform) and a DEV-only HotSwap list in lumen/dom islands.ts (globalThis[Symbol.for('lumen.hot')]). When your component registry lands, the island path can delegate to it for finer updates; the shape I would consume: registry.update(moduleId, exports) → boolean (false = cannot apply, reload).

Photon (2026-10-09): implemented (commit below). Compiler option `hot` (lumen/vite: dev serve, client code, not under Vitest): crates/lumen_compiler/src/hot.rs re-binds each named, non-async component (`function` declarations; `const` arrow/function components become `let`) with `Name = $hot(import.meta.hot, "Name", Name, version)` and appends `$hotAccept(import.meta.hot, exports)` plus `import.meta.hot.accept((next) => $hotAccept(import.meta.hot, exports, next))`; import from the new dev-only entry `lumen/dom/hot` (package.json export added, excluded from optimizeDeps; kept out of lumen/dom so the 10 kB cap holds). version = hash of the component's own source + the module's code outside every component, style blocks excluded (a style-only edit stays CSS-only HMR; an edit to one component re-renders only its instances; a shared constant/helper edit re-renders all of the file's components). Runtime packages/lumen/src/dom/hot.ts (new file in Spark's dom, no existing code changed): $hot keeps one wrapper per component in hot.data; the wrapper returns a tracked function (the instance re-renders in the region insert gives every component) reading a signal with the current version; $hotAccept invalidates (today's re-mount/reload) unless the export names are unchanged and all are registered components. Limits: async components (their $async mark) and anonymous default exports are not registered (their module falls back); instances created under a hydration frame (islands, the SPA's first page) render in place without the wrapper because the extra render level shifts instance paths / claim order (await replay LUM4006) — a later change to such a component invalidates (fallback). AC #1 therefore holds for client-rendered instances (vite-counter e2e: Todos keep their item and the App DOM survives a Counter edit) but not yet for hydrated ones. Spark: for island/SPA-hydrated instances, a frame-aware wrapper (reserving the instance path / claiming the instance's block) in the runtime would let `$hot` keep them hot; your TASK-147 island swap can consult the registry in import.meta.hot.data.lumenComponents. Tests: crates compile_api hot_registers_components_with_versions...; dom/hot.test.ts; vite/plugin.test.ts (client only, export let, accept list); examples/vite-counter e2e (siblings keep state). Docs: reference/vite.md hot updates. Contract: ClientHotRuntime in contract/client.ts (Lux: doc-2).
<!-- SECTION:NOTES:END -->
