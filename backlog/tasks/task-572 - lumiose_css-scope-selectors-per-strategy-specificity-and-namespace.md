---
id: TASK-572
title: 'lumiose_css: scope selectors per strategy, specificity and namespace'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-25 00:30'
updated_date: '2026-10-25 00:39'
labels:
  - css
milestone: m-14
dependencies: []
references:
  - >-
    backlog/decisions/decision-85 -
    Scoped-styles-attribute-or-class-strategy-specificity-and-namespace-scopedStyles.md
  - crates/lumiose_css/src/token.rs
  - crates/lumiose_css/src/selector.rs
priority: high
ordinal: 564000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implements decision-85 in crates/lumiose_css. Replace the fixed `scope_attribute` (`data-l-<token>`) with a scope configuration: strategy (`attribute` | `class`), specificity (`default` | `zero`) and namespace (default `lum`).
- `CssInput` takes the configuration, and hosts derive element markers from the same helper, so templates and CSS agree.
- Selector rewriting per decision-85's table: `[data-<ns>-<hash>]` or `.<ns>-<hash>`, wrapped in `:where()` for `zero`, placed before pseudo-elements as today.
- `:global()`, `:deep()` and scoped `@keyframes` keep their meaning under every combination.
- A namespace validator, which the Vite plugins call at startup.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CssInput takes the scope configuration; the defaults scope with [data-lum-<hash>] and a (0,1,0) bump
- [x] #2 All four strategy and specificity combinations rewrite selectors as decision-85's table shows, including compounds with pseudo-classes, pseudo-elements, :deep() and :global()
- [x] #3 Scoped @keyframes names stay unique per scope under every combination
- [x] #4 A namespace validator accepts only names that start with a lowercase letter and contain lowercase letters, digits and hyphens
- [x] #5 cargo test covers every combination, and existing snapshots are updated for the data-lum- default
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux): standalone takeover of Halo's task at the user's request (M14 run).

2026-10-25 (Lux): lumiose_css exports ScopeStyle { strategy, specificity, namespace } (default attribute/default/lum), with marker() for templates and selector() for CSS, plus validate_namespace and DEFAULT_NAMESPACE. CssInput gains scope_style; the rewriter inserts ScopeStyle::selector (so :deep(), :global(), pseudo-element placement and keyframe suffixes are unchanged). Fixtures: a // @scope directive and scope_class, scope_attribute_zero and scope_class_zero (custom namespace) goldens; existing goldens now use data-lum-. The compiler passes namespace "l" (the legacy data-l- markers it still stamps through scope_attribute) until TASK-573, so compiler output is unchanged. Note for TASK-576 docs: zero specificity relies on :where() (all evergreen browsers; Lightning CSS does not lower it). cargo test --workspace and clippy pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumiose_css takes a ScopeStyle (attribute or class strategy, default or zero specificity, namespace; default attribute/default/lum) and rewrites scoped selectors with it; namespace validation and golden fixtures for every combination. The compiler keeps its legacy data-l- output until TASK-573.
<!-- SECTION:FINAL_SUMMARY:END -->
