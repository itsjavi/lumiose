---
id: TASK-19
title: Emit the CSS manifest and SSR stylesheet links
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 16:27'
labels: []
milestone: m-2
dependencies:
  - TASK-11
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Server-only components have styles too, and Suspense content must not get its CSS late. CSS must be built in the client environment and mapped per route (spec §4.6.6).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All style modules are built in the client environment; a module→CSS manifest is emitted
- [x] #2 A helper computes the <link> set for a route from its static import graph, for use by the shell
- [x] #3 Dev mode uses Vite CSS HMR without duplicating CSS
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Client build (lumen plugin, buildStart, only when the build has a server environment with an input): scan the project once (Lumen modules with style blocks + stylesheet imports of every source module), resolve and emit each stylesheet as an entry chunk of the client build; generateBundle records stylesheet id -> client CSS URLs (viteMetadata.importedCss, before Vite drops pure-CSS chunks).
2. Server build: .stsx style modules load as empty CSS; virtual:lumen/css-manifest is a JSON.parse placeholder filled in renderChunk from the complete server graph (entries + dynamically imported modules -> stylesheets reached through static imports, import order).
3. Dev: unchanged (Nova's ssr-graph links with data-vite-dev-id); verify ids match the client CSS module so the Vite client never injects a copy.
4. Tests: real Vite builds with a config file (per-environment config resolution), dev server test; probe ssr-bookshelf build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (session photon-task19-20261008T161409Z) claimed TASK-19.

## Implementation (Photon)

**API for the shell (Nova, TASK-26):** `virtual:lumen/css-manifest` (served by lumen/vite, packages/lumen/src/vite/css-manifest.ts):
- `export default`: Record<project-relative module path, string[]> — e.g. `{ "src/routes/index.stsx": ["/assets/Card-x.css", ...] }`, URLs already include Vite's `base`, in cascade (import) order. Keys: every entry and dynamically imported module of the server build (route modules, layouts, special pages, document, middleware — whatever the server entry lazy-imports).
- `export function stylesheets(files: readonly string[]): string[]` — deduplicated union in the given order (document, layouts, then the route); unknown files → [].
Integration: in serverEntryCode `import { stylesheets } from "virtual:lumen/css-manifest";` and pass `headAssets: (files) => stylesheets([document, ...files]).map((href) => `<link rel=\"stylesheet\" href=\"${escapeAttr(href)}\">`).join("")` to createRequestHandler (BuiltApp could carry `stylesheets`). In dev the module is empty: keep app/dev/plugin.ts headAssets.

**Client build.** buildStart (client consumer, build, and only when some server environment has an input / build.ssr — a client-only SPA build is unchanged) scans the project once (new src/vite/scan.ts, shared with the island scan: Lumen modules compiled once without CSS → meta.islands, meta.hasStyles and the stylesheet imports of the compiled code; other .[cm][jt]sx? modules searched for static stylesheet imports; ?inline/?url/?raw and @import/import() ignored), resolves them with the client resolver and emits each stylesheet as an entry chunk named after the file. Vite's CSS pipeline makes one CSS asset each (assets/Card-hash.css) and drops their empty JS; generateBundle (enforce pre, before vite:css-post removes pure-CSS chunks) records id → base + viteMetadata.importedCss (cssCodeSplit: false → the single CSS asset). Island chunks that import the same CSS module reuse that asset (no copy).

**Server build.** Style modules load as "" (no CSS processing; dist/server has no CSS). The manifest module is `JSON.parse("__LUMEN_CSS_MANIFEST__")`; renderChunk replaces the placeholder (end of its line, map: null keeps mappings — no sourcemap warning) with the manifest computed from getModuleInfo().importedIds (static only, so components streamed in <Suspense> are included; dynamic import() is not). A stylesheet reached on the server that the client did not build → one warning (e.g. a noExternal package's own CSS import; node_modules are not scanned).

**sharedDuringBuild: true** on the lumen plugin: Vite resolves a config file again per environment (builder.sharedConfigBuild false), which created a new lumen() per environment — the server build could not see the client's records (found on the ssr-bookshelf probe).

**Dev (AC #3).** Nothing to change: app/dev/plugin.ts links the ssr graph's stylesheets with data-vite-dev-id = module id, which equals the client CSS module's __vite__id; Vite 8's client skips updateStyle when a <link> with that id exists (linkSheetsMap), so an island importing the same CSS module injects no copy, and edits are css-update (TASK-45 CSS-only HMR). Covered by a test.

**Evidence.**
- packages/lumen/src/vite/css-manifest.test.ts (5 tests): real Vite 8 builds from a vite.config.ts (base /app/, server sourcemaps): manifest keys = _layout + index only (about has no CSS); index → Card, Late (inside Suspense), Counter in import order; _layout → app.css (plain CSS from a server-only layout), _layout styles; stylesheets() dedupes/orders; dist/client has exactly one CSS asset per stylesheet and no JS for them, crimson only once; dist/server has no CSS; no warnings. Dev server: links for all five with base, data-vite-dev-id == client CSS module __vite__id, island imports the same URL. stylesheetImports unit test.
- src/vite + src/app/production + src/app/dev Vitest: 42/42. tsc, oxlint clean for src/vite.
- ssr-bookshelf (copy in scratch, Nova's build(), probe plugin re-exporting the manifest): client emits assets/styles-*.css, server none; manifest maps (app)/_layout, (static)/_layout and _404 → /assets/styles-k6BrbWxT.css. Prerendered HTML has no links until TASK-26 wires headAssets.

Lux (from Nova, TASK-26): lumen() should expose api: { options: { mode, ssr, trailingSlash, csrf } }, which dev and build already read. CSS link integration notes are in TASK-19 (Nova's handoff).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen/vite now builds every stylesheet in the client environment and serves virtual:lumen/css-manifest. The client build (when the app has a server build) scans the project once (Lumen style blocks and stylesheet imports of all source modules, shared with the island scan), emits each stylesheet as a client entry (one CSS asset each, no JS, reused by island chunks) and records id → URLs; the server build loads .stsx style modules empty (no CSS in dist/server) and fills the manifest in renderChunk from the server graph: each route/layout/document module → its statically reachable stylesheets (incl. components streamed in Suspense) in cascade order, with a warning for stylesheets the client did not build. The module exports the map and stylesheets(files) (deduped, ordered) for the shell's headAssets; Nova wires it in TASK-26. The plugin is sharedDuringBuild so per-environment config resolution keeps one instance. Dev keeps the ssr-graph links whose data-vite-dev-id matches the client CSS module id, so islands inject no duplicate and edits stay CSS HMR. Verified with real Vite builds/dev server tests and a probe build of ssr-bookshelf.
<!-- SECTION:FINAL_SUMMARY:END -->
