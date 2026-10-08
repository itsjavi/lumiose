---
id: decision-24
title: 'MPA navigation options: opt-in View Transitions, hover prefetch by default'
date: '2026-10-08 21:35'
status: accepted
---
## Context

MPA routes (static and server) navigate with full page loads. Cross-document View Transitions and speculation-rules prefetch can make these navigations feel instant, without shipping a client router. The user chose the defaults on 2026-10-08.

## Decision

- **`lumen({ viewTransitions })`** is opt-in and defaults to `false`.
  - When enabled, MPA routes get `@view-transition { navigation: auto }`, disabled under `prefers-reduced-motion`.
  - Authors name the elements they want to morph.
- **`lumen({ prefetch })`** takes `"hover"`, `"viewport"` or `"none"`, and defaults to **`"hover"`**.
  - Lumen generates `<script type="speculationrules">` for same-origin MPA links.
  - In SPA subtrees, `<Link prefetch>` overrides it per link.

## Consequences

- MPA navigations get faster by default, with no surprise animations.
- The options are validated by the Vite plugin and documented. TASK-93 implements them.

_Amended 2026-10-08 (user): `<Link prefetch="none" | "hover" | "viewport">` from `lumen/router` also works on MPA pages, where it renders a plain `<a>` that the speculation rules include or exclude accordingly. It is the per-link way to opt out of or change prefetching. Plain `<a>` links follow the project default._
