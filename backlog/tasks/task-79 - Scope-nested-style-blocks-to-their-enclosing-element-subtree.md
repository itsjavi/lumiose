---
id: TASK-79
title: Scope nested style blocks to their enclosing element subtree
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 20:34'
updated_date: '2026-10-08 20:49'
labels: []
milestone: m-1
dependencies:
  - TASK-77
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user decided (decision-23, amending decision-14) that a <style> inside a component styles only its enclosing element's subtree. A <style> directly under the component's root element therefore still covers the whole component. Today every <style> inside a component applies to the whole component.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each <style> inside a component gets its own scope token, stamped on its enclosing element and every element lexically inside it in that component's JSX (lexical rule: JSX authored inside the subtree, including children passed to components there); file-level and global blocks unchanged; both client and server templates
- [x] #2 Class passthrough ($$scope) at a call site passes the caller's applicable tokens (enclosing-subtree chain + file); lumen_css receives each block with its token (coordinate with Halo if lumen_css's Scope needs a new variant)
- [x] #3 Golden fixtures for nested subtrees, siblings (C1 not styled by a sibling subtree's style), passthrough, async components and .map rows; docs updated (Beacon follow-up note)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. css::ScopePlan: per InJsx scoped block, find its enclosing element/fragment span (JsxParent tag span -> AST element span); one token per style-bearing element per component (sorted by element start; first keeps scope_token(path, name), others scope_token(path, "name#k")); blocks under the same element share the token; lumen_css gets Scope::Component { name, token } per block (no API change).
2. ScopeTokens.components: name -> [SubtreeScope { attribute, span }]; codegen scope_tokens(span) = file + component subtrees containing the element span (both targets: template elements, SSR elements, implicit <tbody> uses strict containment of the rows span, $$scope passthrough at the call-site span).
3. InventoryCollector: per element span, so LUM3005 checks a subtree's selectors against that subtree.
4. napi ScopeTokens shape + UTF-16 span mapping; packages/compiler typings/tests.
5. Golden fixture nested-styles.stsx (nested, siblings, passthrough, async component, .map rows); compile_api test; execution test.
6. Notes: Beacon docs/concepts/styles.md; Halo follow-ups (keyframes visibility along the subtree chain; LUM3005 label for subtrees).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-08): implemented.
- crates/lumen_compiler/src/css.rs: ScopePlan::new(blocks, program, analysis, path) maps each scoped InJsx block's JsxParent (tag-name span / fragment '<') to its AST element span; one token per style-bearing element per component, sorted by element start: the first keeps scope_token(path, name) (components styled under their root keep their token: no golden churn there), the k-th gets scope_token(path, "name#k"). Blocks under one element share it. lumen_css gets Scope::Component { name, token } per block: no lumen_css API change. File/global blocks unchanged. Inventories (LUM3005) are per element span, so a nested block's selectors are checked against its subtree only (golden shows '.c1' in C2's block reported).
- codegen/client/mod.rs: ScopeTokens.components is now name -> Vec<SubtreeScope { attribute, span }>; ScopeTokens::at(component, span, strict) = file attr + the component's subtrees covering span (outermost first). Used by template elements (element.rs), SSR elements (ssr.rs), the implicit <tbody> (strict: a lone styled <tr> does not tag its tbody), and $$scope passthrough at the call-site span (components.rs, so islands too). Lexical rule falls out of span containment: children passed to components, .map callbacks and branches inside the subtree get the tokens; JSX built outside it does not.
- meta.scopeTokens (napi/TS): components: Record<string, SubtreeScope[]> with UTF-16 spans (map_spans); typings regenerated.
- Tests: golden fixture tests/fixtures/client/nested-styles.{stsx,js,server.js,css} (nested A/B1/C1 vs B2/C2, two blocks sharing a token, sibling subtrees, passthrough inside/outside subtrees, children passed to a component, async component, .map rows in a list and a table, static styled <tr>, fragment root, file block); misplaced-style goldens updated (LUM3010 cases now subtree-scoped). compile_api nested_blocks_scope_to_their_enclosing_element. packages/compiler: server.test.ts explicit nested render + client/server parity case; compile/execute/server tests updated to the new meta shape. cargo test/clippy/fmt clean; packages/compiler 38 passed; lumen vite+app 256 passed.
- Impact scan of every repo .stsx: only examples/spa-chiptune/src/ui/Header.stsx (user's uncommitted WIP) has nested subtrees; no committed app code changes styling.
- Known gap -> TASK-83 (Halo): keyframes defined in an enclosing subtree's block are not visible to a nested block (before, all blocks of a component shared a token), and LUM3005's label says 'component X' for a subtree. Exact API proposal in TASK-83 (Scope::Component { outer, subtree }).
- For Beacon (Docs rule): packages/lumen/docs/concepts/styles.md placement table row 'Inside a component's JSX ... That component's own templates' must describe decision-23 (enclosing element subtree, lexical rule incl. children passed to components, root-level block = whole component, passthrough passes the enclosing chain + file); LSP completion should offer classes from enclosing styles + file + globals only (decision-23 consequences); meta.scopeTokens.components shape changed (SubtreeScope[] with spans) if the LSP starts using it.
- For Lux: spec doc-1 §4.6 placement table (line ~228 'Valid. The component scope.') needs the decision-23 wording.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Nested <style> blocks now scope to their enclosing element's lexical subtree (decision-23) on both targets: one token per style-bearing element (first keeps the component token), stamped on the element and every element lexically inside it, the implicit tbody follows the table, class passthrough sends file + enclosing chain, and LUM3005 inventories are per subtree. meta.scopeTokens.components is name -> SubtreeScope[] (attribute + UTF-16 span). No lumen_css API change; keyframes visibility along the chain and subtree LUM3005 labels are TASK-83 (Halo). Goldens nested-styles.*, compile_api and JS parity tests added. Docs follow-ups noted for Beacon (styles.md, LSP) and Lux (spec §4.6).
<!-- SECTION:FINAL_SUMMARY:END -->
