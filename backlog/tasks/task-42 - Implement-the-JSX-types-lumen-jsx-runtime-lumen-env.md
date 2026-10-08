---
id: TASK-42
title: 'Implement the JSX types (lumen/jsx-runtime, lumen/env)'
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:28'
updated_date: '2026-10-08 12:48'
labels: []
milestone: m-1
dependencies:
  - TASK-5
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every Lumen project type-checks with stock TS 7 against Lumen's JSX types. They must encode the accepted syntax: class/style shapes, onX plus on:x events, bind:*, client:*, key, async components, and <style> rejected in .tsx (spec §4.5, §4.7; decisions 7, 9, 13, 17).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen/jsx-runtime exports JSX with IntrinsicElements derived from the DOM and SVG tag maps: typed onX (delegated) and on:x (native) handlers with typed currentTarget, class (string | array | record), style (string | kebab-case object incl. --custom), bind:value/bind:checked (writable signal), attach, ref, innerHTML, key; style is omitted; className, htmlFor and camelCase style keys are rejected
- [ ] #2 IntrinsicAttributes add key and client:load|idle|visible|media|only (with value forms); ElementType accepts sync and async components; ElementChildrenAttribute is defined
- [ ] #3 lumen/env declares the global JSX namespace, import.meta.env (PUBLIC_*) types and the Locals interface hook
- [ ] #4 Type tests (tsd-style .test-d.ts or tsc fixtures run in Vitest) prove accepted and rejected cases on TS 7
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Write src/jsx/jsx-runtime.ts: type-only JSX namespace. Element = Renderable (contract). Per-element attributes derived via mapped types over HTMLElementTagNameMap/SVGElementTagNameMap: common Lumen props (class, style, ref, attach, innerHTML, key, children), typed onX (delegated) + on:x (native, incl. on:${string}) handlers with currentTarget typed, generic attribute values (string|number|boolean|null|undefined|getter-free); bind:value on input/textarea/select, bind:checked on input. 'style' tag omitted; className/htmlFor/camelCase style keys rejected (typed as never / kebab-case-only style object).
2. IntrinsicAttributes: key + client:load|idle|visible|media|only; ElementType accepts sync/async components; ElementChildrenAttribute.
3. Write src/jsx/env.d.ts: global JSX re-export, ImportMetaEnv with PUBLIC_* string index, declare module 'lumen' { interface Locals {} }.
4. Type-test fixtures under src/jsx/__tests__/fixtures (tsconfig jsx preserve, jsxImportSource lumen) with positive and @ts-expect-error cases; Vitest test runs TS 7 tsc --noEmit -p and asserts exit 0.
5. Validate: pnpm typecheck, pnpm test, pnpm lint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented (Beacon):
- src/jsx/jsx-runtime.ts: type-only `export declare namespace JSX`. Element = contract Renderable; ElementType = keyof IntrinsicElements | ((props: any) => Element | Promise<Element>); IntrinsicAttributes = key + client:load|idle|visible(boolean|string)|media(string)|only. IntrinsicElements extends lazy mapped types over HTMLElementTagNameMap (minus style), SVGElementTagNameMap (minus HTML-shared tags) and MathMLElementTagNameMap, plus a `${string}-${string}` custom-element signature (loose, any extra attribute; typed by augmenting the module). Per-tag extras are single lookups (HTMLAttributeMap, BindProps).
- Lumen props: class (string | record<boolean> | nested array), style (string | kebab-case object derived from lib.dom CSSStyleProperties, incl. -webkit-*, float, --custom), ref (el) => void, attach array, innerHTML, key, onX (on + Capitalize<event type>, delegated) and on:x (native) with currentTarget typed, on:${string} bivariant (e: Event) fallback for custom events; className/htmlFor rejected with a descriptive Rejected<hint> type; bind:value on input (string|number signal)/textarea/select, bind:checked on input.
- src/jsx/attributes.ts: HTML attribute names (tabindex, for, http-equiv, accept-charset) — global attrs + aria-*/data-*, per-element catalog for ~45 tags, shared SVG and MathML Core attribute sets.
- src/jsx/env.d.ts: global JSX mirrors lumen/jsx-runtime's JSX (interfaces extend, so both stay augmentable); ImportMetaEnv with readonly PUBLIC_${string}: string plus BASE_URL/MODE/DEV/PROD/SSR identical to vite/client so both merge; declare module "lumen" { interface Locals {} }.
- Perf: KebabCase processes 2 chars/step (~95k instantiations once per program vs 288k for a per-char accumulator; ~+20 ms on TS 7); per-element cost is lazy.
- Tests: src/jsx/__tests__/jsx-types.test.ts runs TS 7 tsc on src/jsx/__tests__/.fixtures (5 .tsx files, 40 @ts-expect-error cases + positive cases; each expected error verified to fire for the intended reason) and on a temp consumer project using the spec tsconfig with types: ["lumen/env"] via a node_modules link. .fixtures is a dot-dir because the package tsconfig (include src, no jsx option) would otherwise fail with TS17004; the fixture program self-resolves `lumen`, so it only fails on diagnostics located in src/jsx or unlocated ones (other areas' WIP errors are left to pnpm typecheck). Mutation check: an unused @ts-expect-error fails the test.
- Known limits: ref<T>() of another element type passes (its () => T getter signature is assignable to any callback); React-style onKeyDown is rejected (typed names are onKeydown) per the Capitalize<event> spec.
<!-- SECTION:NOTES:END -->
