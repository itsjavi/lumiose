---
id: TASK-1
title: 'Survey framework runtimes, rendering models and benchmarks'
status: Done
assignee:
  - '@Prism'
created_date: '2026-10-08 09:59'
updated_date: '2026-10-08 10:30'
labels: []
milestone: m-0
dependencies: []
priority: high
type: spike
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lumen must beat React on js-framework-benchmark and land near or above Solid, Svelte 5 and Vue Vapor, while borrowing the best DX ideas (Remix 3 component, Astro islands). The architecture spec needs current, sourced evidence about how leading frameworks achieve their performance and DX, so design choices are grounded rather than assumed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Covers Solid 2.x, Svelte 5, Vue 3.6/Vapor (alien-signals), Preact signals, React 19.x + React Compiler, Remix 3 component, Astro islands/server islands and Qwik, each with status as of Oct 2026
- [x] #2 Reports current js-framework-benchmark (keyed) standings for those frameworks with source links and date
- [x] #3 Lists concrete runtime/SSR/hydration techniques to adopt and to avoid, with the reason for each
- [x] #4 Findings are recorded in the task notes and referenced by the architecture spec
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started by Lux as orchestrator; research delegated to a Prism subagent (read-only, returns findings).

Research by Prism (a subagent, read-only), recorded by Lux. Raw data and cloned sources are kept in `.local/agents/Prism/`.

## Status (2026-10-08)
- Remix 3.0.0 and `remix/component` 1.0 went stable on 2026-10-01.
- Solid 2 is in RC (rc.14). Vue 3.6 is in RC (rc.10), with Vapor opt-in per component.
- Svelte 5.57. React 19.3 (Compiler 1.0 since Oct 2025). Astro 7.3 (Rust compiler). Marko 6.4.
- TC39 Signals is still Stage 1.
- New overlapping entrants:
  - TSRX: a TSX superset with `@if`/`@for`, raw `<style>` and lazy destructuring. Solid 2 is adding a TSRX frontend.
  - Ripple (TSRX + `track()` signals).
  - Octane (React model, compiled).

## js-framework-benchmark, Chrome 154, keyed (2026-10-04, M4)
Values are CPU weighted geometric mean / run memory / compressed size / first paint.

| Framework | CPU | Run memory | Size | First paint |
|---|---|---|---|---|
| vanillajs | 1.05 | 1.87 MB | 2.5 kB | 53.8 ms |
| alien-signals (manual DOM) | 1.06 | 2.09 MB | 2.9 kB | 52.6 ms |
| Marko 6 | 1.10 | 2.19 MB | 4.8 kB | 55.5 ms |
| Ripple | 1.11 | | | |
| Vue Vapor | 1.11 | 3.06 MB | 18.7 kB | 86.9 ms |
| ivi | 1.13 | | | |
| Inferno | 1.13 | | | |
| Solid 1.9.3 | 1.13 | 2.68 MB | 4.5 kB | 51.6 ms |
| Octane | 1.15 | | 25.1 kB | |
| Svelte 5.42 | 1.18 | | | |
| Vue 3.5 | 1.31 | | | |
| Preact signals | 1.43 | | | |
| React 19.2 hooks | 1.59 | 4.37 MB | 51.4 kB | 226.6 ms |
| React Compiler | 1.65 | | | |
| Qwik | 2.95 | | | |

- React's swap rows takes 89.7 ms (8.2× vanilla). Svelte's select row takes 5.0 ms (2.17×), with no selector optimisation.
- Source: https://krausest.github.io/js-framework-benchmark/2026/chrome154.html

## Key technical findings
**alien-signals** (the base of Vue 3.6 reactivity)
- Push-pull with flags. Each node has deps/subs intrusive doubly-linked lists of `Link` objects.
- A `depsTail` cursor reuses links when dependencies are stable.
- No Set or Map, no recursion. It is the fastest measured core.

**Solid 2**
- Async lives in the reactive graph (`<Loading>` / `<Errored>`). Writes are batched on a microtask, which was contested by the community.
- `createEffect(compute, apply)`. Rust/OXC compiler.
- Hydration uses `_hk` per-element keys and `<!--$-->` holes; serialized values live in `_$HY`.

**Svelte 5**
- Hydration is a positional cursor walk with `<!--[-->` / `<!--]-->` markers and no per-element ids.
- One `template_effect` per template. Unobserved deriveds disconnect from the graph.

**Vue Vapor**
- Events are delegated to `document`, so an ancestor's `stopPropagation` skips them.
- `createFor` uses prefix/suffix trimming plus LIS.
- The compiler detects `row.id === selected` and emits `createSelector`, giving O(1) select.

**Remix 3**
- `function C(handle)`: setup returns a render function; `handle.update()`, `handle.props`, `handle.signal` (AbortSignal), `queueTask`.
- `mix={[on(), ref(), css()]}` mixins. The runtime is a virtual DOM.
- Islands use `clientEntry(import.meta.url, C)` with type-level `SerializableProps`, `<!-- rmx:h:id -->` comment markers and one JSON data script.
- `<Frame src fallback>` streams a template, can be reloaded, and keeps island state.

**Astro**
- `<astro-island>` wrapper with component and renderer URLs.
- Server islands (`server:defer`) make a separate GET per island with encrypted props.

**Qwik and Marko**
- Qwik resumability scores 2.95 CPU.
- Marko 6 compiles the graph to streaming HTML plus resume, scoring 1.10 CPU, 4.8 kB, and the top SSR throughput.

**React RSC**
- Props are duplicated in the HTML and the Flight payload.
- CVE-2025-55182 was a Flight deserialization remote code execution (CVSS 10).

**SSR benchmarks**
- No reputable 2026 cross-framework benchmark exists.
- Platformatic: Vue 1028, Svelte 968, Solid 907, React 572 req/s.
- eknkc: Marko leads by a wide margin.

**Streaming**
- Native `<template for>` + `<?marker>` (declarative partial updates) shipped in Chrome 150 and is in the HTML standard.

## Adopt / avoid (Prism's recommendation; applied in the spec)
**Adopt**
- An alien-signals-style core (vendored, MIT).
- Lazy deriveds that unlink when unobserved.
- Synchronous reads with batched effects and a microtask flush, plus `flushSync`.
- `effect(compute, apply)` bindings.
- Minified template cloning with paths.
- One walk for both create and hydrate.
- Delegation with a data slot, rooted at the island or app root.
- Prefix/suffix trimming + fast paths + LIS for lists.
- Compiler-detected selectors.
- Positional hydration with comment markers.
- One data script plus comment markers per island.
- An inline loader of about 1 kB, with event capture and replay.
- Native `<template for>` streaming with a fallback.
- Data-only serialization.

**Avoid**
- A virtual DOM or re-running component bodies.
- Forward-only keyed moves.
- Per-element hydration keys.
- Full resumability.
- The TC39 polyfill.
- Set or Map per dependency edge.
- Multi-renderer island wrappers.
- A separate HTTP fetch per server island.
- RSC-style dual payloads.

## Risks raised, and how the spec resolves them
1. **TSRX positioning.** The spec differentiates on valid TSX, reactive CSS, islands and agent evals.
2. **Props destructuring in setup-once components.** Resolved by the compiler rewriting destructured props to `props.x` getters, plus the `LUM2001` diagnostic.
3. **CSP blocks SSR `style` attributes.** Resolved by a `csp: "strict"` mode that emits nonce'd per-instance rules.
4. **The benchmark bar is about 1.10.** Targets: CPU ≤ 1.12, ≤ 5 kB, CI benchmarks from M1, and Marko as a comparison target.
5. **Islands mixed with SPA.** Resolved by treating an SPA subtree as one root island; frames come later.
6. **Signal semantics are in flux.** The spec aligns on naming only.
7. **Marko 6** is the closest competitor and must be benchmarked.

## Main sources
https://github.com/solidjs/solid/discussions/2995 · https://github.com/stackblitz/alien-signals · https://github.com/sveltejs/svelte/blob/main/packages/svelte/src/constants.js · https://github.com/vuejs/core/blob/minor/packages/runtime-vapor/src/apiCreateFor.ts · https://github.com/vuejs/core/blob/minor/packages/compiler-vapor/src/generators/for.ts · https://guides.remix.run/interactivity/ · https://github.com/remix-run/remix/blob/main/packages/component/docs/hydration.md · https://docs.astro.build/en/guides/server-islands/ · https://markojs.com/docs/newsletter/june-2026 · https://tsrx.dev/ · https://github.com/octanejs/octane · https://blog.platformatic.dev/ssr-performance-showdown · https://developer.chrome.com/blog/declarative-partial-updates · https://www.vulncheck.com/blog/cve-2025-55182-react-nextjs · https://preactjs.com/blog/signal-boosting/
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Surveyed Solid 2, Svelte 5, Vue 3.6 Vapor/alien-signals, Preact signals, TC39 Signals, React 19.3, Remix 3, Astro 7, Qwik, Marko 6 and the new TSRX, Ripple and Octane, plus js-framework-benchmark Chrome 154 (2026-10-04) and the available SSR benchmarks. Findings and adopt/avoid lists are in the notes. They drive spec doc-1 sections 6, 7.4 and 11 and decisions 8-9. Verified by cross-checking the spec against the notes; sources are linked.
<!-- SECTION:FINAL_SUMMARY:END -->
