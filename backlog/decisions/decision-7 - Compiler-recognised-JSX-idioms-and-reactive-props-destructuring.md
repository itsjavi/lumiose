---
id: decision-7
title: Compiler-recognised JSX idioms and reactive props destructuring
date: '2026-10-08 10:28'
status: accepted
---
## Context

In setup-once components (decision-3), several idioms that humans and agents know from React silently break in Solid-like frameworks:
- Destructured props lose reactivity.
- `.map()` re-creates every row instead of reconciling by key.
- Early returns are not reactive.

The workarounds are `<For>`/`<Show>` components, `splitProps`, TSRX's lazy-destructuring syntax, and Remix's `handle.props`. Each one adds a concept to learn, or new syntax. Lumen's principle is "write it like React, run it like Solid", within valid TSX.

## Decision

The compiler recognises a narrow set of patterns and compiles them to fine-grained equivalents.

**Reactive props destructuring**
- Destructured component parameters, including defaults and `...rest`, are rewritten to `props.x` getter reads.
- This applies to component parameters only. The precedent is Vue 3.5's reactive props destructure.

**Keyed lists from `.map()`**
- `{xs().map((x, i) => <El key={…}/>)}` compiles to keyed reconciliation.
- `key` is optional; without it, items are keyed by reference.
- `i` becomes a reactive index.

**Branches from conditionals**
- `{c() ? <A/> : <B/>}` and `{c() && <A/>}` compile to memoised branches.

**Selector optimisation**
- The pattern `item.key === sig()` inside `.map` compiles to an O(1) `selector()`.

**Non-control-flow runtime components only.** There is no `<For>`/`<Show>`. Runtime components remain only for things that aren't control flow: `<Dynamic>`, `<Portal>`, `<Suspense>` and `<ErrorBoundary>`.

**Diagnostics** cover the patterns the compiler cannot make reactive:
- `LUM2001`: a stale derived value in setup.
- `LUM2003`: an early return that depends on a reactive value.
- `LUM2004`: a component called as a function.
- `LUM2005`: children inserted twice.
- `LUM2006`: a reactive index escaping its callback.

## Consequences

- Code that looks like React compiles to Solid-class output, so agents' first attempts are usually correct.
- Some JavaScript semantics differ inside the recognised patterns. For example, `i` is a reactive index, and `.map` does not produce an array.
- The rules for which patterns are recognised must be documented precisely. The LSP and MCP expose "show compiled output" and execution-contract hovers so the behaviour is visible.
- Patterns the compiler doesn't recognise fall back to correct but unkeyed dynamic inserts. The compiler never miscompiles them.


_Accepted 2026-10-08. The syntax was approved by the user (compiled `.map()`/ternaries; `client:*` directives at the usage site), and the remaining technical parts by Lux under decision-16._
