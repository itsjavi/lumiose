---
id: decision-66
title: Production CSS targets Baseline widely available
date: '2026-10-16 05:22'
status: accepted
---
## Context

Vite's default CSS target, Chrome 111, made Lightning CSS rewrite `:dir(rtl)` into `:lang()` selectors in production builds. The rewrite misses elements whose direction comes from a `dir` attribute, so right-to-left rules worked in dev and broke in builds (TASK-385, TASK-422). The same down-levelling also touched nesting and other modern syntax that every browser Lumiose supports already handles.

## Decision

Orchestrator decision (Lux, 2026-10-16), from Beacon's TASK-422. @lumiose/vite sets `build.cssTarget` to Baseline widely available as of 2026-10-01: Chrome and Edge 123, Firefox 124, Safari 17.4. This matches the browsers stability.md supports. A project's own `build.cssTarget` or `build.target` still wins.

## Consequences

- Production CSS keeps `:dir()`, nesting and other modern syntax, as written, for every app.
- @lumiose/ui's CSS may use `:dir()` again.
- The supported-browsers list in stability.md and the CSS target move together: when one changes, change the other.
- A build test in @lumiose/vite's `plugin.test.ts` guards the target.
