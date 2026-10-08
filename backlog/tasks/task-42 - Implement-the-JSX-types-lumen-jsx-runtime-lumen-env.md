---
id: TASK-42
title: 'Implement the JSX types (lumen/jsx-runtime, lumen/env)'
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:28'
updated_date: '2026-10-08 12:29'
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
