---
id: decision-82
title: >-
  A ?client script that a client module only calls conditionally loads on its
  first call
date: '2026-10-23 23:12'
status: accepted
---
## Context

Components call `?client` scripts (decision-71) to load browser code only where it is needed. On server pages, a script loads only when the page's HTML uses it.

In client builds (islands and SPA pages), each `?client` import became a static side-effect import. A guarded call therefore had no effect in islands:

- `if (openOnHover) popoverHoverScript()` still loaded Popover's hover script;
- `if (modal) dialogScript()` still loaded Dialog's script.

A port found that an island rendering a plain Popover loaded about 1 kB of hover code it never ran (TASK-551).

## Decision

Orchestrator decision (Lux, 2026-10-24, from Photon's TASK-551).

In client builds, a module whose `?client` import is only called inside a condition loads the script lazily: on its first call, once, through `import()`. The condition can be any statement other than a top-level or function-body call of its own.

Everything else keeps the static import:

- unconditional calls;
- other uses of the import;
- side-effect and namespace imports;
- modules that fail to parse.

Server builds do not change.

## Consequences

- **Smaller islands.** An island that renders a plain Popover loads 13.5 kB instead of 15.9 kB (brotli, loader included): its dialog and hover scripts are gone.
- **Behaviour change, in a minor release.** A conditionally called script now runs just after the call instead of before the component runs. Server pages already load scripts this way. A server-rendered island finds the same module the page's HTML already loaded.
- **One limitation.** A custom element that an island passes properties to must be defined by an unconditional call; otherwise its first properties arrive as attributes. This is documented in the Islands and web components guides.
- **Components stay reactive.** A call should sit where the condition is reactive, as `Popover.Trigger` now calls the hover script inside its `hover()` branch, so a condition that turns on later still loads the script. TASK-552 does the same for `Select.Item`.
