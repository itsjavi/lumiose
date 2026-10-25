---
id: TASK-572
title: 'lumiose_css: scope selectors per strategy, specificity and namespace'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-25 00:30'
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
- [ ] #1 CssInput takes the scope configuration; the defaults scope with [data-lum-<hash>] and a (0,1,0) bump
- [ ] #2 All four strategy and specificity combinations rewrite selectors as decision-85's table shows, including compounds with pseudo-classes, pseudo-elements, :deep() and :global()
- [ ] #3 Scoped @keyframes names stay unique per scope under every combination
- [ ] #4 A namespace validator accepts only names that start with a lowercase letter and contain lowercase letters, digits and hyphens
- [ ] #5 cargo test covers every combination, and existing snapshots are updated for the data-lum- default
<!-- AC:END -->
