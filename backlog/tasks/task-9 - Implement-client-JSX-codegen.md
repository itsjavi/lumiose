---
id: TASK-9
title: Implement client JSX codegen
status: In Progress
assignee:
  - '@Photon'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 14:10'
labels: []
milestone: m-1
dependencies:
  - TASK-6
  - TASK-8
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The client output is where Lumen's performance comes from: template cloning plus fine-grained bindings, compiled idioms and delegation (spec §4.5, §5.2, §6.3).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hoisted minified templates with path walks; effect(compute, apply) bindings with hoisted apply functions; one-time writes for static values; signals passed directly as sources
- [x] #2 Components with getter props, reactive props destructuring and rest; children; ref; bind:value/checked; attach; class and style objects
- [x] #3 Compiled .map() keyed lists, selector patterns (both operand orders) and memoised branches; delegated onX with data-slot hoisting, native on:x
- [x] #4 Diagnostics LUM2001 to LUM2006; golden fixtures match the compiler-runtime contract; output is JS with types stripped
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Deps (deps lock): oxc_semantic, oxc_ast_visit, oxc_codegen, oxc_syntax, oxc_transformer =0.153.0 in [workspace.dependencies].
2. Pipeline (lumen_compiler::compile): scan -> oxc_parser(masked) -> semantic -> style hook (resolve $ref bindings for TASK-10, drop ref placeholders and ref-only imports) -> TS strip (oxc_transformer, TypeScript only, JSX preserved) -> semantic -> analyze -> client codegen (VisitMut + AST builders) -> oxc_codegen + source map (original source as sourcesContent).
3. analyze/: components (PascalCase fn returning JSX), props shapes (destructuring, defaults, rest), reactive-read heuristics, diagnostics LUM2001-2005 + AST LUM3010 (map callbacks / nested functions / non-component JSX), await sites (TASK-15 hook).
4. codegen/client/: template tree + minified HTML (trailing closing tags omitted, <!> markers, entities, whitespace normalisation with masked block ranges deleted, SVG <style> verbatim, svg/mathml flags, MultiRoot fragments), path walks, bind with hoisted apply fns + direct signal sources, one-time writes, insert, components (getter props, children getter, mergeProps, $$scope hook), props destructuring rewrite (+restProps), idioms (.map->list with key/index/LUM2006, selector both orders, ternary/&&->branch), class/style per-key, events (camelCase table, delegated $$name + data-slot hoisting, listen for non-bubbling and on:x), bind:value/checked, attach, ref, innerHTML, spread, delegateEvents at module end. Scope-token hook (CompileOptions.scope_tokens) for TASK-10.
5. Diagnostics with original spans; LUM1001 (syntax) / LUM1002 (unsupported, e.g. server target until TASK-14) added to the registry (proposal for Lux).
6. Bindings: compile() in lumen_napi (UTF-16 spans) + packages/compiler typings.
7. Tests: Rust golden fixtures (input -> .client.js + diagnostics snapshot) incl. doc-2 goldens; JS execution test (vitest + happy-dom) against lumen/dom that skips missing runtime exports; cargo test/clippy/fmt.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (from TASK-42 and user decision-17 amendment): delegated event props are React-style camelCase (onKeyDown, onMouseEnter, onDblClick). Codegen lowercases the suffix after 'on' to get the DOM event name (onKeyDown → keydown, delegated if in the bubbling list). on:x keeps the exact name.

Lux: event props come from packages/lumen/src/jsx/events.ts (delegatedEvents table, 104 camelCase names that lowercase to DOM names). onX for a bubbling event is delegated (el.$$name); onX for a non-bubbling event (mouseenter, mouseleave, focus, blur, scroll, load, error, …) compiles to listen(el, name, handler), a direct listener. No diagnostic either way (decision-17 clarification).

Lux: please add a 6xxx range (tooling/config) to the diagnostics registry, with LUM6001 'tsconfig is missing options required by Lumen' (used by lumen check, TASK-27).

## Implementation (Photon)
Layout (crates/lumen_compiler/src): compile.rs (pipeline + CompileOptions/CompileResult/CompileMeta, map_spans); prepare/{style.rs ($ref binding resolution on the masked AST = TASK-10 hook, drops {ref}/;ref; placeholders and imports only $refs use), types.rs (oxc_transformer TypeScript preset only, JSX preserved, enum eval)}; analyze/{mod.rs (components, await sites, LUM2001-2005 + AST LUM3010), components.rs, reactivity.rs}; codegen/ast.rs (builders over the 0.153 node-builder API); codegen/client/{mod.rs (VisitMut driver, names, hoisting, imports), template.rs (template tree, minified HTML, firstChild/nextSibling walks, op emission), element.rs (attributes/class/style/props/ref/attach/bind:*/spread), children.rs (text, markers, insert, fragments/children arrays), components.rs (createComponent, getter props, mergeProps, $$scope), props.rs (destructuring rewrite), idioms.rs (list/key/index/selector/branch, LUM2006), events.rs (delegation table, listen, data-slot hoisting), html.rs, text.rs}. Pipeline: scan → oxc_parser(masked) → semantic → style artifacts → TS strip → semantic → analyze → client VisitMut → oxc_codegen (program.source_text = original, so sourcesContent/columns are the authored file). Our code avoids oxc_traverse (only oxc_transformer uses it internally for the TS strip).

API: lumen_compiler::compile(source, filename, &CompileOptions{target, scope_tokens, source_map, style_import}) → {code, map, diagnostics, meta{components[name,span,exported,isAsync,awaitSites], templates, delegatedEvents, runtimeHelpers, styleRefs[block,path,span,binding{name,declaration,kind module/local/import}], hasStyles}}. napi compile() (UTF-16 spans) + regenerated packages/compiler typings; lumen_wasm compile() too. Server target → LUM1002 diagnostic (TASK-14).

Codegen decisions: templates hoisted (/* @__PURE__ */, deduped), trailing closing tags omitted (raw-text elements keep theirs), implicit <tbody> spelled out for <tr> in <table>, leading newline kept in pre/textarea, SVG/MathML flags by tag + namespace context, SVG <style> verbatim, masked blocks deleted before whitespace normalisation. Static = literals/identifiers (one-time setAttr/assign/insert); dynamic = calls/members/tagged templates (bind with hoisted apply fns; count() of a never-reassigned binding passed directly). <!> only between text and text or before another dynamic part, otherwise the next static sibling is the marker, the last part appends. setText/text-slot only when the value is provably text (literals, templates, arithmetic, string methods); otherwise insert. Reactive conditionals returned by components and by .map() row callbacks become tracked functions. Delegated set excludes non-bubbling events and wheel/touchstart/touchmove (passive at document) → listen. Row handlers capturing only the item + module/setup-stable bindings are hoisted (module or component setup) with $$xData = item. Selectors are declared right before their list() call (component setup for root lists).

Hooks: TASK-10 → CompileOptions.scope_tokens {file, components} (every template element gets the tokens; $$scope at call sites passing class; applyScope where props.class is applied) + meta.styleRefs. TASK-15 → meta.components[].awaitSites (site order) and enter_component/leave_component in codegen/client/props.rs are where try/finally $leave() and the $await rewrite go; client:* attributes are already dropped.

Validation: cargo test --workspace (lumen_compiler 33 unit, 20 client golden fixtures in tests/fixtures/client incl. doc-2 §5.1-5.4, 6 compile_api tests incl. source-map lookup, scanner goldens unchanged; lumen_wasm 2), clippy --workspace --all-targets -D warnings, fmt --check, vitest project compiler 16/16 (compile.test.ts API + execute.test.ts: 7 cases compiled by the native addon and run on the real lumen/dom in happy-dom; skips cases whose helpers lumen/dom lacks), tsc + oxlint + oxfmt clean for packages/compiler. Perf (release): 10.4k-line / 430 KB .stsx with 400 components in ~20 ms (parse 2 ms, semantic x2 ~2.5 ms, TS strip 0.5 ms, codegen ~7.5 ms, print ~3.5 ms); a 12-line component ~0.1 ms.

Contract change requests (proposals for Lux, not applied): (1) doc-2 §5.2/§5.4 show setText/.data for row.label()/m.name; the compiler cannot prove those are text, so it uses insert (a node/array value would otherwise print as [object …]); suggest the goldens use insert or define a text-hint rule. (2) Direct sources only for identifier calls: passing row.label for row.label() loses this. (3) The data slot holds the row item (handler reads fields at event time, exact closure semantics) rather than row.id. (4) branch/list need a parent, so conditionals and .map() in component children, fragments and nested ternary arms fall back to tracked functions (re-created on change); suggest a parentless memo/branch returning a Renderable. (5) Registry: added LUM1001 Syntax error and LUM1002 Unsupported (server target until TASK-14) — spec §5.4 table needs them. (6) SSR (TASK-14) must emit the same implicit <tbody>. Known limitations: select value set before dynamic options are inserted; comments attached to a removed/first statement may move below hoisted declarations.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the client JSX codegen in lumen_compiler: compile() runs scan → oxc_parser on the masked text → oxc_semantic → $ref binding resolution and placeholder removal (TASK-10 hook) → TypeScript strip via oxc_transformer → analysis → a VisitMut client transform → oxc_codegen with source maps against the original source. Output follows contract doc-2: hoisted minified templates with firstChild/nextSibling walks, bind() with hoisted apply functions and direct signal sources, one-time writes, insert with minimal <!> markers, createComponent with getter props/children/mergeProps/$$scope, reactive props destructuring with defaults and restProps, keyed list from .map() with key/index accessor/selector hoisting, memoised branch, per-key class/style, delegated events with data-slot hoisting and listen for non-bubbling/on:x, bind:value/checked, attach, ref, innerHTML, spread, fragments as MultiRoot templates, SVG/MathML flags and delegateEvents at module end. Diagnostics LUM2001-LUM2006 and AST-level LUM3010 carry original spans; LUM1001/LUM1002 were added to the registry (proposal for spec §5.4). compile() is exposed through lumen_napi (UTF-16 spans, regenerated @lumen/compiler typings) and lumen_wasm; the server target reports LUM1002 until TASK-14. Verified by 20 golden fixtures (incl. doc-2 §5.1-5.4), compile API and source-map tests, clippy/fmt, and 16 vitest cases of which 7 compile real components and run them on lumen/dom in happy-dom. A 10k-line file compiles in ~20 ms. Contract change proposals (setText only for provable text, item as data slot, parentless branch/list) are in the notes.
<!-- SECTION:FINAL_SUMMARY:END -->
