---
id: TASK-79
title: Scope nested style blocks to their enclosing element subtree
status: In Progress
assignee:
  - '@Photon'
created_date: '2026-10-08 20:34'
updated_date: '2026-10-08 20:42'
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
- [ ] #1 Each <style> inside a component gets its own scope token, stamped on its enclosing element and every element lexically inside it in that component's JSX (lexical rule: JSX authored inside the subtree, including children passed to components there); file-level and global blocks unchanged; both client and server templates
- [ ] #2 Class passthrough ($$scope) at a call site passes the caller's applicable tokens (enclosing-subtree chain + file); lumen_css receives each block with its token (coordinate with Halo if lumen_css's Scope needs a new variant)
- [ ] #3 Golden fixtures for nested subtrees, siblings (C1 not styled by a sibling subtree's style), passthrough, async components and .map rows; docs updated (Beacon follow-up note)
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
