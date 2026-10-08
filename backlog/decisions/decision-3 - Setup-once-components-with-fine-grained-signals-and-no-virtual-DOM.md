---
id: decision-3
title: Setup-once components with fine-grained signals and no virtual DOM
date: '2026-10-08 10:02'
status: accepted
---
## Context

Lumen must be faster on paper than the latest React on js-framework-benchmark and close to or better than Solid, Svelte 5 and Vue Vapor. The fastest frameworks all compile templates and update the DOM through fine-grained reactive bindings instead of re-running components and diffing a virtual DOM. Lumen must also be intuitive for humans and agents. React's hooks rules, dependency arrays and stale closures are a frequent source of agent mistakes.

Alternatives considered:
- Remix 3 style: plain variables plus `handle.update()` to re-run a render function. It is explicit and simple, but needs diffing and is slower on partial-update benchmarks.
- Svelte-runes-like compiler magic: `let x = $state(0)`. It is concise, but its non-standard semantics inside `.tsx` confuse TypeScript, agents and humans.

## Decision

- A component is a PascalCase function that takes props and returns JSX. Its body is a **setup scope that runs once per instance**. There are no hooks rules and no dependency arrays.
- State uses signals: `signal(v)` (read `count()`, write `count.set(v)` / `count.update(fn)`), `computed(fn)`, `effect(fn)`, plus deep-reactive `store(obj)` for nested data. The API shape follows Angular and Solid, and stays aligned with the TC39 Signals proposal where practical.
- The compiler turns JSX into hoisted HTML templates instantiated by cloning, plus fine-grained bindings for dynamic parts. There is **no virtual DOM** and no component re-render.
- Lifecycle and cleanup are owner-scoped functions such as `onMount` and `onCleanup`, with an AbortSignal helper for web-standard cleanup.
- The exact reactive algorithm and scheduling follow the TASK-1 research and are specified in the architecture spec.

## Consequences

- The DOM update cost is proportional to what changed, which puts Lumen in the Solid, Svelte 5 and Vue Vapor performance class.
- Reading a signal in the setup scope outside a reactive context is not reactive, which is the classic Solid pitfall. The compiler must warn about this and suggest `computed`.
- Props must stay reactive. The compiler rewrites destructured props into getter access, as Vue 3.5 does with reactive props destructure, so idiomatic destructuring works.
- Components cannot be called as plain functions to "re-render". Documentation and diagnostics must make the setup-once mental model explicit.


_Signal syntax `count()` / `count.set(v)` / `count.update(fn)` confirmed by the user on 2026-10-08._
