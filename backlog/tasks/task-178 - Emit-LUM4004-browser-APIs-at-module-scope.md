---
id: TASK-178
title: 'Emit LUM4004: browser APIs at module scope'
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-09 14:59'
updated_date: '2026-10-09 15:44'
labels:
  - compiler
  - diagnostics
dependencies: []
priority: medium
ordinal: 178000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the eval suite (TASK-40): LUM4004 is documented and registered but never emitted; reading localStorage (or window/document/navigator…) at module scope of a server-rendered module passes lumen check and crashes SSR.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Compiler emits LUM4004 for browser globals evaluated at module top level of modules in server graphs (not inside functions, effects or typeof guards); lumen check/LSP/Vite agree; tests; LUM4004 docs accurate
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-09): crates/lumen_compiler/src/analyze/browser_globals.rs: unresolved references to browser-only globals (window, document, localStorage, sessionStorage, navigator, location, history, matchMedia, requestAnimationFrame, customElements, observers, HTMLElement, …) evaluated at module scope; not inside functions/arrows/classes, not `typeof X`, not code guarded by a typeof check (if/conditional/&&), not local or imported bindings. Emitted for the server target (lumen/vite's ssr environment, so dev and build warn for modules of server graphs) and with the new compile option browserGlobals (napi/wasm), which lumen check / the language server set for every compiled module; LUM4004 is dropped for client-only files: modules importing lumen/dom (client entries) and spa routes with ssr = false (check, from the manifest). Plain .ts modules are not analysed (documented). Tests: compile_api lum4004_..., cli/check/check.test.ts (component reported, client entry not), vite/plugin.test.ts (ssr compile warns, client does not). Examples: pnpm typecheck and builds of bookshelf/journal/chiptune/dotmatrix report no LUM4004. Docs: errors/LUM4004.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LUM4004 is emitted for browser globals evaluated at module scope of server-graph Lumen modules (Vite ssr compile; lumen check/LSP for non-client-only modules); typeof guards, functions and classes excluded; tests and docs.
<!-- SECTION:FINAL_SUMMARY:END -->
