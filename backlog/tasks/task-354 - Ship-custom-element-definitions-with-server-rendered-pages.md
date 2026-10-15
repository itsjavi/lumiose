---
id: TASK-354
title: Ship custom element definitions with server-rendered pages
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-15 16:46'
updated_date: '2026-10-15 17:47'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-346
priority: high
ordinal: 355000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike, proposal and measurements in TASK-332's notes). A page that renders a Menu or Combobox on the server, without an island, needs those elements' definitions in the browser (finding F2; see also TASK-283). The spike loaded them from instrumentation.client.ts by path. Ship each used element's definition with the pages that render it, and only those, without the island runtime. TASK-346 (F1) fixes the runtime leak a dynamic import causes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A server-rendered page with a lu-* element loads that element's definition and no island runtime
- [x] #2 Pages without lu-* elements load none
- [x] #3 Tests cover static, server and prerendered SPA pages
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Nova): implemented behind an internal name; the public spelling waits for the user (Proposal below), so the task stays In Progress.

Mechanism. A component imports the module that must run in the browser through an import marker, and calls what the marker exports when it renders:

    import defineMenu from "./menu.element.ts?lumiose-client";
    function MenuRoot(props) { defineMenu(); return <lu-menu>…</lu-menu>; }

- Server (dev, server pages, prerendering): the call records the module's client URL for the page being rendered. The page loads it once, as `<script type="module" async>` with modulepreloads for its imports, in the head or in the chunk of the streamed boundary that rendered it (packages/lumiose/src/server/client-script.ts, `Unit.scripts`). The module never runs on the server.
- Browser (islands, SPA pages): the marker imports the module statically and the call does nothing. Islands and SPA chunks import the same chunk file that server pages load: one module instance.
- Build (packages/vite/src/client-scripts.ts, a plugin of `lumiose()`): the one-time project scan (packages/vite/src/scan.ts) finds the markers in the project and its linked packages; the client build builds each module as an entry (the chunk islands share, without a facade) and the server build embeds its URL. A marker the scan did not see warns and records nothing. The module keeps its side effects whatever its package's `sideEffects` says.
- TASK-346's helper placement now covers every entry pages load without the runtime (the client entry and client scripts), so a script with `import()` does not pull the runtime in.
- Outside my area (Lux informed): scan.ts reports the markers (`clientScripts`), index.ts registers the plugin.

Evidence. Build test "loads the client scripts of server-rendered components on the pages that render them (TASK-354)": a static page, a page that imports the component without rendering it (no script), a server page whose streamed boundary renders it, a prerendered SPA page, an island, in a package with `"sideEffects": false`; the definitions throw if run on the server. Dev-server test (URL `/src/ui/lu-menu.element.ts`). Renderer tests (client-script.test.ts: once per page, per streamed boundary, folded into the head when prerendering). Real browser: examples/ui-spike option (b) switched to the marker locally, without loading the elements from instrumentation.client.ts, passes its Playwright suite in dev and build (28 passed; not committed, the spike is Halo's and goes away in TASK-363). Bytes, brotli: spike page /b loads 2.5 kB of JS (menu 0.90 + combobox 1.10 + the spike's own instrumentation.client.ts 0.19 + helpers 0.33), against 13.0 kB in TASK-332 (runtime 10.8).

Proposal for the user (public shape; nothing recorded as a decision):
- P1, implemented: an import query whose default export is called while rendering. Query candidates: `?client` (the client side of a module; decision-49 reserves `.client.` only in file names, a query is elsewhere), `?script`, `?browser`.
- P2: the same import used as a component, `<MenuScript />`, instead of a call.
- P3, not tried: an import attribute, `with { lumiose: "client" }`.
- It also answers TASK-283 (small client scripts without the island runtime): a theme toggle's script would be `import theme from "./theme.ts?client"` plus `theme()` in the header component.
- Once named: the marker's module type in lumiose's JSX types (Beacon), a "Client scripts" section in concepts/islands.md, and the rename of `?lumiose-client` (CLIENT_SCRIPT_QUERY, the scan regex, tests).

Hand-off to Halo (TASK-357 Menu, TASK-358 Combobox, @lumiose/ui):
- Each Root that renders a lu-* element imports its definition with `?lumiose-client` and calls it in the component body; no side-effect `import "./elements.ts"`.
- Until the public name lands, declare the marker locally: `declare module "*?lumiose-client" { const clientScript: () => void; export default clientScript; }`.
- Element modules must not import lumiose (they would load the runtime). They no longer run on the server, so the `globalThis.HTMLElement ?? Object` guard is only needed if server code imports them otherwise. Still list them in `sideEffects` for other bundlers.
- The scan covers the app and linked workspace packages. A package installed from npm (node_modules) is neither scanned nor compiled by default (`exclude`), the same as its islands and `.stsx` styles: to settle with @lumiose/ui's packaging (TASK-353).

2026-10-15 (user): the public spelling is the ?client query (P1), recorded as decision-63. Next: rename ?lumiose-client to ?client, add the module type to lumiose's JSX/env types, write the docs section, and point TASK-283 at it.

2026-10-15 (Nova): renamed ?lumiose-client to ?client (decision-63) in the plugin (packages/vite/src/client-scripts.ts; the virtual module id is now \0lumiose:client-script:<file>), the scan and the tests. lumiose/env declares "*?client" with a default () => void (packages/lumiose/src/jsx/client-modules.d.ts, with a type fixture in jsx/__tests__/.fixtures/client.tsx). Docs: concepts/islands.md ("Scripts of server-rendered components: ?client", with a checked example and an API row), guides/web-components.md (definitions through ?client instead of a guarded import), reference/jsx.md (lumiose/env) and reference/vite.md; docs:gen and docs:check run. Validation: pnpm check (2041 tests; size caps 9.22/10 kB and 13.37/15 kB brotli) and every Playwright suite. Done.
<!-- SECTION:NOTES:END -->
