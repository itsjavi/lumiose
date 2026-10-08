---
id: decision-17
title: 'Event handler syntax: delegated onX and native on:x'
date: '2026-10-08 12:13'
status: accepted
---
## Context

Lumen needs a single event syntax that is familiar to people and agents, fast on the js-framework-benchmark, and able to reach native listener features: non-bubbling events, custom events from web components, and listeners on elements outside delegation roots. The user picked this option on 2026-10-08 over Remix 3-style `on()` mixins.

## Decision

- **`onClick={fn}` is delegated.** The `onX` (camelCase) form covers bubbling events. The handler is stored on the node (`$$click`, plus a `$$clickData` slot when the compiler can lift row data), and one listener per event type sits at the delegation root.
- **`on:click={fn}` attaches a native listener** with `addEventListener`, removed on cleanup. Use it for non-bubbling events (`scroll`, `focus`, `mouseenter`), custom events and web-component events. It also covers any case where delegation is unwanted.
- **Handlers receive the typed native event.** `currentTarget` is typed, and there are no synthetic events.
- **Delegation root.** Delegation listens at the `document` level, with one listener per event type. Handlers are found by walking from `event.target` up to the island or app boundary. This works because islands have no wrapper element (decision-9). An ancestor's `stopPropagation` outside Lumen cannot block delegated handlers that sit below it.

## Consequences

- The syntax is React-familiar, and it is the fastest option on the benchmark.
- Types must declare both `onX` and `on:x` for every element.
- The compiler decides which events are delegated using a fixed list of bubbling events. Anything else that is written as `onX` gets a diagnostic suggesting `on:x`.

_Amended 2026-10-08 with user approval: delegated handlers use React-style camelCase names (`onKeyDown`, `onMouseEnter`, `onPointerDown`, `onDblClick`). The compiler lowercases the part after `on` to get the DOM event name. Exact-case forms such as `onKeydown` are rejected by the types. Native listeners keep the exact event name: `on:keydown`, `on:my-event`._
