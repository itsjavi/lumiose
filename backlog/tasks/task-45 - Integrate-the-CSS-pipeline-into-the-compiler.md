---
id: TASK-45
title: Integrate the CSS pipeline into the compiler
status: In Progress
assignee:
  - '@Photon'
created_date: '2026-10-08 13:59'
updated_date: '2026-10-08 16:01'
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
- [x] #1 $ref resolution via oxc_semantic on the masked AST, including constant folding of imported consts (requested from the host); LUM3008/LUM3013
- [x] #2 Per-scope tokens stamped on every element in scope in client and server templates; $-only imports removed from JS output; cssDeps reported
- [x] #3 Class passthrough: call sites pass $$scope, and children apply it via applyScope wherever props.class is applied
- [x] #4 compile() returns css + map alongside code; golden fixtures
- [x] #5 lumen/vite serves CSS virtual modules (File.stsx?lumen&type=style&lang.css) through the Vite CSS pipeline; style-only edits hot-update CSS without remounting; cssDeps invalidate on token edits
- [x] #6 The TASK-11 example app gains scoped styles and $tokens, verified in a browser
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

Nova (from TASK-24, for Photon): lumen dev links every stylesheet module reachable from the rendered route files in the ssr module graph (<link rel=stylesheet href=url data-vite-dev-id=id>, app/dev/plugin.ts stylesheets()); .stsx style modules (?lumen&type=style&lang.css) are picked up as soon as compiled server code imports them. For CSS-only .stsx edits: filter the .stsx JS module out of the ssr environment's hotUpdate modules (any order before 'post'); the dev plugin then sends css-update instead of a full reload. Decision-21: lumenDev reads lumen({ mode, ssr }) from the 'lumen' plugin's api.options — please expose api: { options } on that plugin.

Lux (from Nova, TASK-24): expose api: { options } (mode/ssr) on the lumen plugin; for CSS-only .stsx edits drop the JS module from the ssr hotUpdate list.

## Implementation (Photon)

**Pipeline** (crates/lumen_compiler/src/compile.rs): scan → parse → semantic (with nodes only when a block has refs) → `prepare::resolve_style_refs` (bindings + folding, LUM3008) → `strip_style_artifacts` → TS strip → semantic → analyze → `css::ScopePlan` (tokens) + `css::inventories` → codegen (stamps tokens) → print → `css::process` (lumen_css) → `{ code, map, css, cssMap, cssDeps, moduleRequests, diagnostics, meta }`. `CompileOptions.scope_tokens` is gone: tokens are computed (`scope_token(root-relative path[, component])`, attribute `data-l-<token>`) and reported in `meta.scopeTokens`. New options: `emit_css`, `css { targets, minify }` (napi `emitCss`, `cssTargets` browserslist queries — throws when invalid, `cssMinify`), `modules`.

**Constant folding** (crates/lumen_compiler/src/prepare/constants.rs): path evaluation on the masked AST through oxc_semantic symbol → declarator: literals, template literals, + - * / % **, unary -/+, `as const`/satisfies/parens, object members (incl. spreads, computed literal keys), `const { a: { b } } = obj` destructuring, identifier/member chains, cycles detected. Imports: named, default, namespace (`$tokens.radius.lg`), `export *`, `export { x } from`, `export * as ns`, `export default <expr>`, JSON modules (named exports = members of default), `.stsx` modules (scanned/masked first).

**Host protocol for imported constants (spec §5.1 "requested from the host").** The core stays pure. `compile()` looks up each import in `options.modules` by `(importer, specifier)`; a module the host has not supplied becomes `result.moduleRequests[{ importer, specifier }]` and `css` is withheld (no diagnostics for pending refs). The host resolves/loads them (`resolved: { id, source }`, or omitted = unresolvable → LUM3008) and compiles again; imports inside host modules come back as requests with the host module id as importer, so transitive constants work in more rounds. `cssDeps` = ids of host modules read. Chosen over a sync JS callback: identical in Rust/napi/wasm, works with async resolvers (Vite `this.resolve`), and the warm path is one compile per round-trip (a style-free file never requests anything).

**Diagnostics.** Registry: LUM3014/3015/3016 added. CssDiagnostic → Diagnostic via `Code::from_id(code.id())`. Hyphenated refs are found with `lumen_css::find_refs(..).hyphenated` and left to lumen_css (LUM3009), never LUM3008. LUM3008 messages say why (let binding, reassigned, call at runtime, no export `x`, module could not be resolved, not declared, …) with a `declared here` label and the style-prop help. LUM3013 stays in the scanner. LUM3012 is not run per file: a property set in one file is often read by another file's CSS, so a per-file check gives false positives → follow-up for a project-wide check. The scanner keeps its own ref finder; a test (`scanner_and_css_pipeline_find_the_same_references`) asserts it finds exactly the sites `lumen_css::find_refs` finds over all .stsx fixtures (reusing find_refs directly would drop the scanner's masking-specific rule for `$a$b`).

**Inventories** (crates/lumen_compiler/src/css.rs): per token, intrinsic tags, static classes (strings, class objects' keys, arrays, conditional/logical string leaves), ids, classes passed to components (passthrough); spreads, dynamic class/id and `ref`/`attach` mark the kind dynamic (no LUM3005 for it).

**Class passthrough**: existing codegen ($$scope at call sites passing class, applyScope/spreadAttrs where props.class is applied, incl. destructured `class: x`) now fed with real tokens; verified by goldens, execute/server Vitest and in the browser (App's file-scoped `.panel` lands on Counter's and Todos' roots).

**lumen/vite** (packages/lumen/src/vite/index.ts + new styles.ts): transform compiles with the request loop (`this.resolve` + fs) and caches the CSS per file; the `?lumen&type=style&lang.css` load serves it (recompiling when the file on disk differs, e.g. after a style-only HMR) and `addWatchFile`s every cssDep, so constants modules become imports of the CSS module in the graph. `hotUpdate`: for a Lumen file, compile the new source for the environment's target; same JS and no JS errors → only the CSS module is updated (the parser recovers from some JS errors with identical code, hence the error check); a constants-module edit updates the CSS modules of its dependents. Style diagnostics of a CSS-only edit are reported by the CSS module's load (overlay). A file that stops parsing keeps serving its last CSS. Islands scan compiles with `emitCss: false`.

**Example** (examples/vite-counter): App.stsx (component `h1`, file-scope `main` + `.panel` passed as class to Counter/Todos, `<style global>` body), Counter.stsx and Todos.stsx with component styles, all `$theme.*` from src/tokens.ts (import removed from JS). `typecheck` is now `lumen check` (tsconfig rootDirs + .lumen/shadow; `.lumen/` gitignored in the example).

**Evidence.**
- cargo test --workspace green; new: 23 client goldens now also golden the CSS (`<name>.css`, identical for both targets) incl. new `style-constants.stsx` (folding through namespace import, `export *`, re-export, destructuring, LUM3005/3008/3009) and `styles.stsx` (file/component/global order, :global, keyframes); host modules for goldens in tests/fixtures/client/modules; compile_api: request protocol (incl. transitive), LUM3008 for unresolvable/let imports, root-relative tokens, CSS source map, minify/targets, scanner↔lumen_css ref parity. clippy -D warnings and fmt clean for lumen_compiler/napi/wasm; lumen_wasm builds without browserslist.
- Vitest: packages/compiler 33/33 (CSS + folding + requests via napi; WASI parity now includes Lightning CSS + browserslist, WASI rebuilt); packages/lumen/src/vite/plugin.test.ts 14/14 (CSS module through Vite's CSS pipeline in client and ssr, alias-resolved token import tracked as CSS-module import, style-only edit → only the CSS module in the HMR payload, recovered JS error → JS update, style error after a style-only edit → LUM3008 from the CSS module with loc, token edit → dependents' CSS modules).
- Playwright (examples/vite-counter, Chromium): 9 passed / 3 skipped by design (dev + build/preview): computed styles for global/file/component scopes, no leaking (Counter `h2`/`button`, Todos `ul`), passthrough `.panel` on both children, dynamic `.hot`; dev: style edit + token edit hot-update the CSS with the count kept and no reload. Screenshots: backlog/assets/task-45-vite-counter-styles.png, backlog/assets/task-45-style-hmr.png.
- pnpm typecheck green; pnpm lint: only warnings in other agents' files. pnpm test: 784/785 — the failure is packages/lumen/src/cli/docs/examples.test.ts (Beacon's docs example routes/blog/[slug].stsx triggers LUM2001, unrelated to this task).

**For others.** Beacon: docs/concepts/styles.md status note ("the Vite plugin does not emit the CSS yet") is outdated; LUM3014-3016 exist now. Lux: spec §5.4 registry table needs 3014/3015/3016; spec §5.1 option names changed (no scopeTokens). Nova/TASK-19: server-compiled modules import the same `?lumen&type=style&lang.css` module; its CSS is target-independent; `meta.hasStyles`/`cssDeps` are available for the manifest.
<!-- SECTION:NOTES:END -->
