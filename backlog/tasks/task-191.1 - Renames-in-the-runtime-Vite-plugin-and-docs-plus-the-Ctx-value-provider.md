---
id: TASK-191.1
title: 'Renames in the runtime, Vite plugin and docs, plus the <Ctx value> provider'
status: Done
assignee:
  - Spark
created_date: '2026-10-10 18:17'
updated_date: '2026-10-10 18:41'
labels:
  - api
  - dx
dependencies: []
parent_task_id: TASK-191
priority: high
ordinal: 198000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-35, doc-7. Apply every approved rename in packages/lumiose/src (core, dom, app, router; src/core/server.ts mirrors), packages/vite (HMR entry detection keys on render from lumiose/dom), packages/compiler tests, and packages/lumiose/docs: inject→useContext, provide→<Ctx value> provider (createContext returns a provider component, React 19/Solid 2), lifetime→getAbortSignal, pending→isPending, busy→isBusy, submitting→isSubmitting, flushSync→flush, navigating→isNavigating, search/Search/SearchInit→searchParams/SearchParams/SearchParamsInit, mount→render. Docs: LUM4003 hint points to lumiose/router; ErrorBoundary fallback arg named reset; store documented as mutable; an Upgrading page with the migration table. Breaking commits use '!'. Size: find savings to stay ≤10 kB (doc-1 §6 update), raising up to 12 kB only if 10 kB is impossible.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every rename applied in the runtime, Vite plugin, compiler tests and lumiose docs; old names removed (no aliases)
- [x] #2 <Ctx value> provider works on client, server and hydration, with tests; provide/inject gone
- [x] #3 Upgrading page with the migration table; pnpm typecheck/test/lint/docs:check green for these packages; size cap met or raised per doc-1 §6 with numbers recorded
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (2026-10-10), standalone worker under Lux's claim.

Provider mechanism: createContext(default) returns a function component with `id` and `defaultValue` (Context<T> has a call signature `(props: { value: T; children?: Renderable }) => Renderable`, so `<Ctx value>` type-checks with the JSX types; fixture src/jsx/__tests__/.fixtures/context.tsx). The provider calls provideContext(id, value) on its own (lazy) owner, so children evaluated by the `children` getter during setup see it. Function children (content the compiler defers, e.g. `{() => items()}`, `{props.x}`) are evaluated later by the region that renders the provider's output, under that region's owner. They are wrapped (bindChildren): each call creates a child owner of the calling owner with the value provided, and runs the original function under it; returned content is wrapped again. The owner is disposed with what the call rendered, and siblings rendered by the same region never see the value. No compiler change: client and server codegen both emit createComponent(Ctx, { value, get children() }) (checked with a compiled sample). Same implementation on the server (content() resolves inline under the provider owner; wrapping is harmless there).

`value` reactivity: read once at setup, like Solid's provider and every prop read in a component body. useContext() is itself setup-once, so a tracked value would not reach consumers anyway; tracking would mean re-creating the subtree on change (surprising, costly). Changing state is shared by providing a signal, store or object with getters. Documented in reference/reactivity.md, concepts/signals.md and upgrading.md.

Internals renamed: injectContext → readContext, injectUserContext → readUserContext; provideContext no longer throws without an owner (all callers run under one). flushSync wrapper removed: the internal flush() is the export. dom/mount.ts → dom/render.ts. Router internals currentSearch/setSearch → currentSearchParams/setSearchParams. LUM4010 registry title "Island reads context provided by the page"; runtime warning says useContext().

Tests: new src/dom/context.test.ts (client nesting/shadowing, function children + disposal, sibling isolation, value read once with a provided signal, SSR nesting and function children); hydrate.test.ts: TASK-194 case uses <Theme value>, new compiled-JSX hydration case with nested/shadowed providers around conditional and list content (no LUM4006, nodes claimed, updates after hydration); island.test/render.test/server-renderer tests converted to providers. Verified the function-children tests fail without bindChildren.

Size (brotli, "core + dom (every export)", cap 10240 B): baseline at HEAD 10197 B; with the provider 10231 B; after savings 10186 B (9.95 kB). Savings, no CPU cost: Symbol descriptions dropped (-29 B), getAbortSignal() owner check DEV-only (-16 B), flushSync wrapper removed. HARD_CAP unchanged. Typical imports 6209 B (soft 6400). "islands on top of typical" soft target was 2.76 kB OVER before and still is.

Validation: lumiose typecheck 0 errors, tests 722 passed; vite typecheck clean, 115 passed; compiler tests 45 passed (2 skipped); cargo test -p lumiose_compiler green; oxlint exit 0 (4 pre-existing warnings); docs:gen + docs:check green; cli docs tests 17 passed. Root `pnpm typecheck` fails in out-of-scope consumers (first: benchmarks/fullstack/apps/lumiose, `submitting`), left to TASK-191.2.

Commit: c07d91e refactor!: approved API renames and the <Ctx value> provider (TASK-191.1).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All decision-35 renames applied in packages/lumiose (src, docs), packages/vite (HMR entry keyed on render), compiler tests and the diagnostics registry, with no aliases. createContext returns a <Ctx value> provider that works on client, server and hydration (function children bound to the provider's value; value read once). New docs page upgrading.md with the migration table; store documented as mutable; ErrorBoundary fallback arg named reset; LUM4003 points to lumiose/router. Size stays under the 10 kB cap (10186 B brotli, from 10197 B before). Consumers (examples, apps, tooling, benchmarks, evals) are TASK-191.2.
<!-- SECTION:FINAL_SUMMARY:END -->
