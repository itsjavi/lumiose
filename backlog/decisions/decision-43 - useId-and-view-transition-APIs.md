---
id: decision-43
title: useId and view transition APIs
date: '2026-10-12 18:38'
status: accepted
---
## Context

Two building blocks are missing for 1.0 (user, 2026-10-12):

- Unique ids that match between the server render and hydration, for accessible forms (`for`/`id`, `aria-describedby`, `aria-controls`).
- Animating changes within a page. Page navigations already use cross-document View Transitions through CSS (`viewTransitions: true`), but elements entering, leaving or moving in an SPA or an island have no helper. React offers `<ViewTransition>`.

## Decision

Approved by the user on 2026-10-12, with these names:

- **`useId(): string`** from `lumiose`, named like `useContext`. On the server the id comes from the component instance's position in the render tree; inside islands, from the island id and the island-relative instance path the runtime already tracks. Hydration reuses the server id; client-only renders use a counter. A prefix option keeps several apps on one page apart. Called once in a component's setup.
- **`viewTransition(fn): Promise<void>`**: runs a state update inside `document.startViewTransition`, flushing signal updates so the DOM changes inside the transition. Without browser support, or with `prefers-reduced-motion: reduce`, it runs `fn` without a transition. The SPA router uses it for navigations.
- **`<ViewTransition name? enter? exit?>`**: gives its single child element a `view-transition-name` (from `useId()` unless `name` is passed) and enter/exit classes, so conditionals and lists animate when they change inside `viewTransition()`.

Both view transition APIs are opt-in imports that tree-shake out of bundles that do not use them (the runtime stays under its 10 kB cap).

## Consequences

- Smaller than React's `<ViewTransition>`: no transition types or batching model of its own, since signals already update synchronously and `flush()` exists.
- It also covers the enter/exit animation gap of conditionals and lists.
- Tasks: TASK-247 (useId), TASK-252 (view transitions).
