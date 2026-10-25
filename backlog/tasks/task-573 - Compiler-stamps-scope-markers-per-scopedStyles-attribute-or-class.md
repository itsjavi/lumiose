---
id: TASK-573
title: Compiler stamps scope markers per scopedStyles (attribute or class)
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-25 00:30'
updated_date: '2026-10-25 00:51'
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
- [x] #1 compile() and the napi bindings accept scopedStyles (strategy, specificity, namespace); the defaults emit data-lum-<hash>
- [x] #2 With strategy class, static and dynamic class values, spreads and SSR output carry the scope classes in a single class attribute; with strategy attribute the output matches today apart from the namespace
- [x] #3 $$scope passthrough works under both strategies in the format agreed with the runtime task, tested for the client and server targets
- [x] #4 meta.scopeTokens reports the configured names
- [x] #5 cargo test --workspace and the compiler package tests pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux): standalone takeover of Photon's task at the user's request (M14 run).

2026-10-25 (Lux): compile() takes CssOptions.scoped (ScopedStyles: strategy, specificity, namespace; default attribute/default/lum), and napi takes scopedStyles { strategy, specificity, namespace } (an invalid namespace throws) plus validateScopeNamespace(). The default output is now data-lum-<hash>.
- Attribute strategy: output as before, with the namespace.
- Class strategy: client templates merge the markers into the static class (or add one); setClass leaves them alone, and spreads go through setClass. The server merges them into the single class attribute: static values are baked; class objects get them as baked keys; computed values go through classAttr(value, scope); spreads through spreadAttrs(props, custom, scope). An element without a class gets class="…"; a tbody gets them too.
- $$scope format, agreed for TASK-574: space-separated tokens, attribute names as they are, classes as ".name". The runtimes need: applyScope applying ".name" through classList; server classAttr(value, scope?) merging the ".name" tokens of scope into the class list; spreadAttrs(props, custom?, scope?) merging scope and the ".name" tokens of props.$$scope into the class it writes (or writing one).
- meta.scopeTokens reports the configured markers; lumiose_css::scope_attribute is gone.
- Goldens: scoped-classes (class strategy: static/object/array/computed/spread/passthrough/tbody) and scoped-zero (attribute, zero, namespace app); existing goldens moved to data-lum-; compile_api test for class/zero/app.
- JS tests that asserted data-l-<hash> now assert data-lum- (cli mcp, vite, web playground and samples, compiler package). The MCP stripHtml also strips data-lum-* (the configured namespace is wired with TASK-576).
- Left for TASK-576: e2e specs, examples, evals and docs that still say data-l-.
cargo test --workspace, clippy, and the full vitest run (2619 passed) pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The compiler and napi take scopedStyles: attribute markers (data-lum-<hash> by default) or class markers merged into each element's class on the client and the server, $$scope carrying classes as .name, and meta.scopeTokens naming the configured markers. Goldens cover both strategies, zero specificity and a custom namespace; tests that hard-coded data-l- were moved to the new default.
<!-- SECTION:FINAL_SUMMARY:END -->
