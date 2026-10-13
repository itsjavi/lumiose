---
id: decision-46
title: SVG components only through an explicit ?component import
date: '2026-10-13 23:45'
status: accepted
---
## Context

Decision-22 made every project `.svg` import an inline component, with `?inline` as an alias, while `.svg` files under `node_modules` kept Vite's URL import because a library importing its own `.svg` expects one. That left no way to use an icon set shipped as SVG files (Lucide's `lucide-static`, Tabler, Heroicons) as components without copying the files, since `?inline` did not lift the `node_modules` exception.

The bare import also had two other costs:

- `vite/client` declares `*.svg` as a URL string, so loading it alongside `lumiose/env` made whichever came first win, with a duplicate declaration in the two `.d.ts` files (TASK-122).
- `?inline` already means something else in Vite: a base64 data URL for assets.

## Decision

User decision, 2026-10-14, choosing between "always explicit" and "bare or `?component`":

- **An `.svg` import is a component only with `?component`**, in project files and in `node_modules` alike: `import House from "lucide-static/icons/house.svg?component"`.
- **A bare `.svg` import is Vite's URL again**, and `?inline`, `?url` and `?raw` are Vite's own.
- `?lumiose` was rejected because the compiler already uses it for components' CSS modules. `?react` was rejected because it suggests React. `?component` is the convention of `vite-svg-loader` and the SvelteKit SVG plugins.
- There is no deprecation alias for the old forms (decision-47).

## Consequences

- `lumiose/env` declares `*.svg?component` (plus `?url` and `?raw`) and no bare `*.svg`, so it no longer clashes with `vite/client`, which types bare asset imports.
- The SVG plugin no longer needs a `node_modules` exception. It recognises `component` among the import's query parameters, because Vite adds `?v=` and `?import` to dependency imports in dev.
- Amends the SVG part of decision-22.
