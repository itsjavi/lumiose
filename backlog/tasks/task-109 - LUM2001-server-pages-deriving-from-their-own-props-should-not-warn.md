---
id: TASK-109
title: 'LUM2001: server pages deriving from their own props should not warn'
status: Done
assignee:
  - Photon
created_date: '2026-10-09 04:03'
updated_date: '2026-10-09 04:42'
labels:
  - compiler
  - diagnostics
dependencies: []
priority: medium
ordinal: 109000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from TASK-86. A server-mode page deriving a value from its own props (params.slug.toUpperCase()) still warns LUM2001, because the compiler does not know the route mode. Needs the route mode passed by the Vite plugin and lumen check / language server (same answer in all three).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pages whose route mode is server or static do not get LUM2001 for reads of their own props; islands and spa routes still do; Vite, lumen check and the LSP agree
- [x] #2 Golden or unit tests; LUM2001 docs page updated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: raised to MEDIUM after TASK-38 (it shapes how every page is written; samples wrap pages in components to avoid it).

Photon (2026-10-09): CompileOptions.serverRoute (napi/wasm serverRoute?: boolean): the module is a route module rendered only on the server; the default export (export default function/arrow, export default X, export { X as default }) gets Component.server_props: its props bindings are neither reactive reads nor 'calls of local bindings' for LUM2001/LUM2003 (props.slug.toUpperCase() is fine); other components of the file keep the rule. Route modes: vite/server-routes.ts serverRouteFiles(manifest) = pages and layouts whose mode is not spa (scanRoutes with lumen({ mode, ssr })). lumen/vite: transform passes serverRoute (scan cached, reset by watchChange under src/routes). lumen check: the provider context now carries the route manifest (check/index.ts, small cli edit) and compilerDiagnostics passes serverRoute. Language server: lumen/tooling isServerRoute(root, file) (rescans routes per call, default mode read once per root) used by language-server/src/providers.ts (small edit in Beacon's area). Tests: compile_api server_routes_read_their_own_props_without_lum2001; src/vite/server-routes.test.ts (static/server/spa pages, layout, component); cli/check/check.test.ts (spa page reported, static page not; isServerRoute). Docs: errors/LUM2001.md. Special pages (_404/_error) are not treated as server routes (no mode in the manifest).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LUM2001/LUM2003 no longer fire for server/static pages and layouts reading their own props; compile() takes serverRoute, decided from the route manifest identically in lumen/vite, lumen check and the language server (lumen/tooling isServerRoute).
<!-- SECTION:FINAL_SUMMARY:END -->
