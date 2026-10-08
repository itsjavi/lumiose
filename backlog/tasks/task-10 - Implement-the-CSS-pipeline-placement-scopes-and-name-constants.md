---
id: TASK-10
title: >-
  Implement the lumen_css crate: scoping, selector rewrite and constants
  substitution
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 14:28'
labels: []
milestone: m-1
dependencies:
  - TASK-8
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The CSS pipeline is split so it can proceed in parallel with client codegen. This task builds the standalone lumen_css crate. The compiler integration (constant folding via oxc_semantic, token stamping in templates, class passthrough, cssDeps) is TASK-45 (Photon).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumen_css API: process(blocks with placement + scope token, resolved $ref values, targets, minify) → { css, map, diagnostics }; file-scope CSS first, then component blocks in source order
- [x] #2 Selector rewrite: [data-l-<hash>] on the last compound (before pseudo-elements), :global(), :deep() (left side only), scoped @keyframes and rewritten animation/animation-name references, custom properties untouched, SVG blocks passed through verbatim
- [x] #3 $ref substitution of resolved values in values and @media/@container/@supports preludes only (never in selectors, strings, comments, url()); LUM3009 for hyphenated refs; LUM3005 unused-selector check given an element/class inventory input; LUM3012 hook
- [x] #4 Lightning CSS pinned exactly; nesting lowered per targets; minify; source maps back to the original .stsx offsets (whitespace-padding approach)
- [x] #5 Golden fixtures and cargo test/clippy/fmt pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pin lightningcss =1.0.0-alpha.72 (+ parcel_sourcemap =2.1.1) in [workspace.dependencies]; lumen_css feature `browserslist` (default) so wasm can opt out.
2. Own input/output types (no lumen_compiler dependency): CssInput { filename, source, blocks { content span, scope Global|File|Component, svg }, refs { span -> String|Number }, inventories, style custom properties }, CssOptions { targets, minify, source_map } -> CssOutput { css, map, diagnostics, custom_properties_read }. scope_token() helper so templates and CSS share one hash.
3. Text pre-pass per block (own CSS lexer): $ref sites (values + @media/@container/@supports preludes only) substituted from resolved values, LUM3009; selector preludes rewritten (token on last scoped compound before pseudo-elements, :global() stripped, :deep() joins left-scoped part), LUM3005 against inventories. Edits recorded in a position map.
4. Lightning CSS per block (error recovery), AST pass: scoped @keyframes + animation/animation-name rewrite (same file scope), var() reads for LUM3012; merge rule lists (file blocks first, then component blocks in source order), minify per targets, print.
5. Source maps composed: Lightning CSS map (block-text positions) remapped through the position map to .stsx line/UTF-16 column (padding rejected: $ref substitution changes lengths).
6. Golden fixtures in tests/fixtures + unit tests; cargo test/clippy/fmt.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (TASK-9 hooks for the CSS pipeline): compile() already resolves every $ref to its binding with oxc_semantic on the masked AST (lumen_compiler::prepare::style → CompileMeta.style_refs: block index, path, span, binding {name, declaration span, kind Module{constant}/Local{constant}/Import{source, imported}}) and drops imports used only by $refs from the JS. Scope tokens plug in through CompileOptions.scope_tokens {file: Option<String>, components: name → token}: the client codegen adds them to every template element of the scope, passes $$scope at component call sites that pass class, and emits applyScope(el, props.$$scope) where props.class is applied. Fixture tests/fixtures/client/styles.stsx shows the output.

Halo (session halo-task10-20261008T140036Z) claimed TASK-10. Lightning CSS: latest crate is 1.0.0-alpha.72 (2026-07-20), pinned exactly.

## Implementation (Halo)

**Deps.** `lightningcss =1.0.0-alpha.72` (latest, features sourcemap+visitor; `browserslist` via lumen_css's default feature so wasm can opt out) and `parcel_sourcemap =2.1.1` in [workspace.dependencies]. No dependency on lumen_compiler.

**API** (crates/lumen_css/src/lib.rs): `process(&CssInput, &CssOptions) -> CssOutput`. CssInput { filename, source, blocks: [CssBlock { content: Span, scope: Scope::{Global{component}, File{token}, Component{name, token}}, svg }], refs: [ResolvedRef { span, value: RefValue::{String, Number} }], inventories: [ElementInventory], custom_properties_set: [CustomPropertySet] }; CssOptions { targets: Targets, minify, source_map }; CssOutput { css, map: Option<String>, diagnostics: Vec<CssDiagnostic>, custom_properties_read }. Helpers: `scope_token(path, Option<component>)` (8-char base36 FNV-1a+fmix64), `scope_attribute(token)`, `find_refs(css)`, `browserslist_targets(&[q])`. CssDiagnostic mirrors lumen_compiler's Diagnostic; `CssCode::id()` gives the LUM id.

**Decisions.**
- Selector scoping is a text pre-pass (own lexer) before Lightning CSS: keeps Lightning CSS's own parse of final selectors (exact specificity, pseudo-element flags; its Selector rebuild API drops them) and gives exact spans. Lightning CSS parses `:global/:deep` only as raw-token custom functions.
- `:global(sel)`: Svelte-like; the token goes on the last compound with a scoped part (type/class/id/attr/*/&), so `.a :global(.b)` → `.a[t] .b`; all-global selectors stay global; `:global(.x):hover` is global. `:deep(sel)`: Vue-like; `.a :deep(.b)`/`.a:deep(.b)` → `.a[t] .b`, leading `:deep(.b)` → `[t] .b` (top level) or `.b` (nested). Compounds containing `&` are not re-scoped. Nested rules get the token on their own last compound (`.a { .b {} }` → `.a[t] .b[t]`).
- Keyframes: `name-<token>` in scoped blocks; references resolve own component first, then file scope; other components' and global keyframes are untouched.
- $refs: lumen_css's finder (same rules as scanner css_refs) is the authority for substitution sites; values matched by exact span. Unresolved refs are left as-is (caller reports LUM3008/3013); hyphenated ones are never substituted and get LUM3009 (fix `$a.b` when parts are identifiers, otherwise subtraction help).
- Source maps: composed, not padded (substitutions and attributes change lengths, so padded columns drift). Lightning CSS map (block texts, source_index = block) → position map → .stsx line/UTF-16 column; JSON has sources=[filename], sourcesContent=[source]. AC #4's padding wording superseded by this (allowed by the brief).
- SVG blocks are skipped (verbatim in templates). Order: file-level (file + top-level global) blocks, then component-level, each in source order; blocks are merged into one stylesheet so Lightning CSS can merge across blocks.
- LUM3005 conservative: only the token-receiving compound's type/class/id, skips escaped names, `dynamic_*`, and tag/id checks when a class is a component (passthrough) class. LUM3012 is per file; `custom_properties_read` enables cross-file checks.

**New codes for the registry (Photon/Lux to add; ids already used by CssCode::id):** LUM3014 CssSyntaxError (Error, Lightning CSS parse/minify/print failure; practically only minify/print with error recovery on), LUM3015 InvalidCssIgnored (Warning, rule/declaration/selector dropped or unknown pseudo-class), LUM3016 InvalidScopeSelector (Error, `:global`/`:deep` without argument, nested or repeated `:deep()`). Also uses LUM3005, LUM3009, LUM3012.

**Evidence.** `cargo test -p lumen_css`: 19 unit tests + golden test over 9 fixtures (tests/fixtures/{scoping,global_deep,keyframes,refs,svg,targets_minify,sourcemap,unused,errors}.stsx/.out; UPDATE_FIXTURES=1 regenerates); `cargo clippy -p lumen_css --all-targets -- -D warnings` (with and without default features); `cargo fmt -p lumen_css --check`; rustdoc -D warnings; `cargo check --workspace` OK.

**Limitations.** wasm32 target not installed here, so the wasm build of lightningcss/browserslist-rs is unverified. The pre-pass lexer (like the scanner) does not support `{}` inside custom-property values. `@scope` preludes are not scoped (bodies are). LUM3014 is defensive (no golden: unreachable with error recovery and our options).

**For TASK-45 (Photon).** Map StyleBlock→CssBlock (skip expression-position blocks); stamp `scope_attribute(scope_token(root_relative_path, component))`; pass ResolvedRef with StyleRef.span; do not report LUM3008 for hyphenated refs (`find_refs(..).hyphenated`, or `-`+ident right after the span); build inventories per token incl. component_classes; convert CssDiagnostic by `Code::from_id(code.id())`; consider making the scanner reuse `lumen_css::find_refs` for parity; lumen_wasm may want `default-features = false`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built the standalone lumen_css crate on Lightning CSS 1.0.0-alpha.72 (pinned). `process()` takes a file's blocks (File/Component/Global scopes, SVG flag), resolved $refs by span, browser targets, minify/source-map flags, optional element inventories and style-prop custom properties, and returns one stylesheet (file-level blocks first, then component blocks in source order), a source map composed back to .stsx line/UTF-16 columns, and LUM diagnostics. A text pre-pass substitutes $refs only in values and @media/@container/@supports preludes and scopes selectors ([data-l-<token>] on the last scoped compound before pseudo-elements, :global/:deep); an AST pass scopes @keyframes and rewrites animation references; Lightning CSS lowers nesting per targets and minifies. Diagnostics: LUM3005, LUM3009 (with fix), LUM3012, plus new LUM3014/3015/3016 that the compiler registry must add (TASK-45). Covered by 19 unit tests and 9 golden fixtures; clippy, fmt and rustdoc clean.
<!-- SECTION:FINAL_SUMMARY:END -->
