---
id: TASK-9
title: Implement client JSX codegen
status: In Progress
assignee:
  - '@Photon'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 13:28'
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
- [ ] #1 Hoisted minified templates with path walks; effect(compute, apply) bindings with hoisted apply functions; one-time writes for static values; signals passed directly as sources
- [ ] #2 Components with getter props, reactive props destructuring and rest; children; ref; bind:value/checked; attach; class and style objects
- [ ] #3 Compiled .map() keyed lists, selector patterns (both operand orders) and memoised branches; delegated onX with data-slot hoisting, native on:x
- [ ] #4 Diagnostics LUM2001 to LUM2006; golden fixtures match the compiler-runtime contract; output is JS with types stripped
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
<!-- SECTION:NOTES:END -->
