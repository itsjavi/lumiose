---
id: TASK-573
title: Compiler stamps scope markers per scopedStyles (attribute or class)
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-25 00:30'
labels:
  - compiler
  - css
milestone: m-14
dependencies:
  - TASK-572
references:
  - >-
    backlog/decisions/decision-85 -
    Scoped-styles-attribute-or-class-strategy-specificity-and-namespace-scopedStyles.md
  - crates/lumiose_compiler/src/css.rs
  - crates/lumiose_compiler/src/codegen/client/element.rs
  - crates/lumiose_napi/src/lib.rs
priority: high
ordinal: 565000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implements decision-85 in crates/lumiose_compiler and the napi bindings.
- `compile()` takes `scopedStyles` and passes it to lumiose_css.
- **Attribute strategy.** Client and SSR codegen stamp the configured attribute, as they do today.
- **Class strategy.** Scope classes are merged into static `class` strings in templates. They are kept beside dynamic `class` values and spreads; `setClass` only removes the classes it added itself. The SSR output carries a single `class` attribute.
- **Passthrough.** `$$scope` carries the tokens in a form the runtimes can apply under either strategy. Agree the format with the runtime task, which depends on this one. Lux updates the contract (doc-2 §1, §5.3) to the agreed format.
- `meta.scopeTokens` reports the configured names.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 compile() and the napi bindings accept scopedStyles (strategy, specificity, namespace); the defaults emit data-lum-<hash>
- [ ] #2 With strategy class, static and dynamic class values, spreads and SSR output carry the scope classes in a single class attribute; with strategy attribute the output matches today apart from the namespace
- [ ] #3 $$scope passthrough works under both strategies in the format agreed with the runtime task, tested for the client and server targets
- [ ] #4 meta.scopeTokens reports the configured names
- [ ] #5 cargo test --workspace and the compiler package tests pass
<!-- AC:END -->
