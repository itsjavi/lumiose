---
id: TASK-45
title: Integrate the CSS pipeline into the compiler
status: In Progress
assignee:
  - '@Photon'
created_date: '2026-10-08 13:59'
updated_date: '2026-10-08 15:36'
labels: []
milestone: m-1
dependencies:
  - TASK-11
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lumen_css (TASK-10) works on resolved inputs. The compiler has to feed it constants and scope information and stamp tokens into templates (decisions 12 and 14).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 $ref resolution via oxc_semantic on the masked AST, including constant folding of imported consts (requested from the host); LUM3008/LUM3013
- [ ] #2 Per-scope tokens stamped on every element in scope in client and server templates; $-only imports removed from JS output; cssDeps reported
- [ ] #3 Class passthrough: call sites pass $$scope, and children apply it via applyScope wherever props.class is applied
- [ ] #4 compile() returns css + map alongside code; golden fixtures
- [ ] #5 lumen/vite serves CSS virtual modules (File.stsx?lumen&type=style&lang.css) through the Vite CSS pipeline; style-only edits hot-update CSS without remounting; cssDeps invalidate on token edits
- [ ] #6 The TASK-11 example app gains scoped styles and $tokens, verified in a browser
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Registry: LUM3014/3015/3016; lumen_compiler depends on lumen_css (default-features off; napi turns browserslist on, wasm leaves it off).
2. prepare/constants.rs: $ref constant folding on the masked AST (oxc_semantic bindings): literals, templates, arithmetic, as const/satisfies, object member paths, identifier/member chains, imports. Imported modules come from the host through a request protocol (CompileOptions.modules keyed by importer+specifier; missing ones are returned as result.moduleRequests, the host loads them and compiles again; transitive imports work the same way). LUM3008 (with style-prop help) for non-constants/unresolved; hyphenated refs left to lumen_css (LUM3009).
3. compile(): scope tokens computed from the root-relative path (file + per component, block→component by span), stamped by the existing codegen; element inventories (tags/classes/ids/component classes, dynamic flags) collected by the codegen per token; lumen_css::process → css + cssMap; CssDiagnostic → Diagnostic by id; cssDeps = ids of host modules used. Class passthrough ($$scope/applyScope) verified on both targets.
4. napi/wasm/typings: css, cssMap, cssDeps, moduleRequests, modules + cssTargets/cssMinify options; styleRefs gain value.
5. lumen/vite: CSS virtual module served from a per-file compile cache through Vite's CSS pipeline; host module loading via this.resolve + fs with the request loop; addWatchFile for cssDeps; hotUpdate drops the JS module when its code is unchanged (CSS-only HMR) and maps token-file edits to dependent CSS modules.
6. Goldens (.css outputs), unit tests, Vitest plugin tests, examples/vite-counter with component/file/global styles and $tokens from tokens.ts, Playwright (computed styles, no leaking, style-edit HMR without remount).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (session photon-task45-20261008T153134Z) claimed TASK-45.
<!-- SECTION:NOTES:END -->
