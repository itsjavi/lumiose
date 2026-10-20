---
id: decision-71
title: 'Small scripts go through ?client, with data in attributes'
date: '2026-10-20 21:20'
status: accepted
---
## Context

TASK-283 comes from the itsjavi.com port. Any page with an island loads the island runtime, about 13 kB gzip on the port, where the Astro site's inline scripts were 1-2 kB.

The `?client` import (decision-63) already ships a typed browser script without the runtime, but it has three limits:
- It isn't released yet: 0.4.0 predates it.
- Its default export takes no arguments.
- `.html` imports with a `<script>` still load their script through an empty `client:load` island.

The grilling session of 2026-10-20 (decision-70) weighed two alternatives:
- **A separate "no runtime" mode.** More surface for the same job.
- **Typed arguments to `?client` calls.** They suit one-per-page scripts, but they need rules for multiple instances, islands, SPA pages and streamed chunks. In effect they would become a second, lighter island system next to the real one.

## Decision

Approved by the user on 2026-10-20.

- `?client` is the only mechanism for small scripts of server-rendered components. There is no separate mode.
- `.html` imports with a `<script>` ship it through the same path, without an empty island.
- Server data reaches a `?client` script through attributes. The docs show a typed pattern:
  - A custom element declared in `JSX.IntrinsicElements`, so the server side is type-checked.
  - The script reads its attributes in `connectedCallback`.
  
  No new API: the default export stays `() => void`.
- Typed arguments come back up only if the itsjavi.com port, once it uses `?client`, still shows the need.

## Consequences

- TASK-283 implements it.
- Each instance carries its own data. Custom elements upgrade wherever they appear: streamed boundaries, SPA navigations, and Markdown or CMS HTML.
- Attribute values are strings, so parsing stays in the script.
