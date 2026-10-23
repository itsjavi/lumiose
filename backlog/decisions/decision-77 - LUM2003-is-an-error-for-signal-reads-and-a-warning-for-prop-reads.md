---
id: decision-77
title: LUM2003 is an error for signal reads and a warning for prop reads
date: '2026-10-23 09:01'
status: accepted
---
## Context

LUM2003 (reactive early return) was an error for any reactive read in the condition of an `if` that returns early from a sync component. The reads were zero-argument calls (`user()`, `props.user()`), props member reads (`props.kind`) and destructured props.

A port (TASK-492) hit it in a component that never renders in the browser and picks its markup on a prop (`if (props.kind === "a") return <A />`). The error failed `lumiose check` although the props never change. The same logic written through a local (`const kind = props.kind; switch (kind) { … }`) passed, because the check looked neither through locals nor at `switch` statements. apps/web's `UiDemo` (a `switch` on `props.id`) passed for the same reason.

The two kinds of read differ:
- A signal read is reactive wherever the component renders in the browser: the component is written to react.
- A prop read is stale only when the component renders in the browser (an island's subtree or an SPA page) **and** a parent passes a value that changes. That depends on the call sites and on the module graph, not on the component.

For one case the compiler knows the props never change: the default export of a route rendered only on the server (`serverRoute`, TASK-109), which already gets no LUM2001/LUM2003 for its props. For every other component it does not. It compiles one module at a time, and the language server, `lumiose check` and the dev server would each need the whole client graph to tell. TASK-290 asks the same question for LUM2001.

## Decision

Orchestrator decision (delegated to Photon by Lux, 2026-10-23, for TASK-523).

- **Severity by the kind of read.** LUM2003 stays an error when the condition reads a signal or calls an accessor: a zero-argument call such as `count()`, `store.count()` or `props.user()`. It is a warning when the condition reads only props: `props.kind`, a destructured prop, or a zero-argument method of a prop's value (`props.title.trim()`, `title.trim()`). The warning's message says the early return goes stale only if a parent passes a changing value. When both kinds appear, the signal read decides.
- **Every form, the same diagnostic.** The check follows locals declared from a reactive value (`const kind = props.kind`, `const isA = kind === "a"`), with the strongest kind they derive from. It uses LUM2001's rules for what derives a value: factory calls and functions do not. It also checks `switch` statements with a returning case, on their discriminant and case tests. So the direct form and the local-variable form get the same code and severity. A diagnostic through a local labels the local's declarator.
- **Unchanged.** Server routes' own props (no diagnostic), async components (no diagnostic, their body re-runs), and LUM2001.

## Consequences

- Server-only components that branch on props build and pass `lumiose check`, with a warning where they return early on a prop. Client components keep a signal for the case that is always a bug.
- A real client bug, an island child that returns early on a prop its parent passes from a signal, is now a warning rather than an error. The LUM2003 page shows the fix: move the condition into the returned JSX.
- Code that passed before through a local or a `switch` can now get LUM2003, as an error when the condition reads a signal. apps/web's `UiDemo` now gets the warning.
- TASK-290 (LUM2001 in server-only components) should use the same split if it lowers LUM2001 for props-only derivations, and lower LUM2003's prop case with it, so the two diagnostics treat a prop read alike.
- LUM2001 does not flag a value stored straight from a zero-argument call (`const n = count()`), which it treats as a factory call. LUM2003's derived locals follow the same rule, so that gap is tracked as its own task.
