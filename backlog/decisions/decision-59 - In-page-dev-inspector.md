---
id: decision-59
title: In-page dev inspector
date: '2026-10-15 07:41'
status: accepted
---
## Context

React developers ask what replaces React DevTools: the component tree, props, and why something rendered. Lumiose had diagnostics and an error overlay but nothing to inspect owners, signals or islands. Decision-57 asked for an in-page inspector before any browser extension; the proposal is in TASK-323.

## Decision

User decision, 2026-10-15.

- `lumiose dev` injects a dev-only inspector in a shadow root, next to its error overlay. **Alt+Shift+L** or a corner button opens it; **`lumiose({ inspector: false })`** turns it off.
- Panels: **Tree** (owners, a props snapshot, source locations), **Signals** (values, dependents, the last write), **Islands** (strategy, state, timings, load failures), and **Why did this update** (the chain of signal writes that re-ran a node or effect).
- **Alt+click** an element to open its `.stsx` source at the line through Vite's open-in-editor endpoint.
- The reactive core and the island loader call a dev hook registry only behind `DEV`, so builds keep none of it and the size caps (decision-55) are untouched. The same registry can feed a browser extension later.
- Rejected: a browser extension first, click-to-source only, logging helpers.

## Consequences

- Implemented in TASK-341.
