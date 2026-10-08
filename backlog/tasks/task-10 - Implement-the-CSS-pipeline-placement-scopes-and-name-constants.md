---
id: TASK-10
title: >-
  Implement the lumen_css crate: scoping, selector rewrite and constants
  substitution
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 14:10'
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
- [ ] #1 lumen_css API: process(blocks with placement + scope token, resolved $ref values, targets, minify) → { css, map, diagnostics }; file-scope CSS first, then component blocks in source order
- [ ] #2 Selector rewrite: [data-l-<hash>] on the last compound (before pseudo-elements), :global(), :deep() (left side only), scoped @keyframes and rewritten animation/animation-name references, custom properties untouched, SVG blocks passed through verbatim
- [ ] #3 $ref substitution of resolved values in values and @media/@container/@supports preludes only (never in selectors, strings, comments, url()); LUM3009 for hyphenated refs; LUM3005 unused-selector check given an element/class inventory input; LUM3012 hook
- [ ] #4 Lightning CSS pinned exactly; nesting lowered per targets; minify; source maps back to the original .stsx offsets (whitespace-padding approach)
- [ ] #5 Golden fixtures and cargo test/clippy/fmt pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (TASK-9 hooks for the CSS pipeline): compile() already resolves every $ref to its binding with oxc_semantic on the masked AST (lumen_compiler::prepare::style → CompileMeta.style_refs: block index, path, span, binding {name, declaration span, kind Module{constant}/Local{constant}/Import{source, imported}}) and drops imports used only by $refs from the JS. Scope tokens plug in through CompileOptions.scope_tokens {file: Option<String>, components: name → token}: the client codegen adds them to every template element of the scope, passes $$scope at component call sites that pass class, and emits applyScope(el, props.$$scope) where props.class is applied. Fixture tests/fixtures/client/styles.stsx shows the output.
<!-- SECTION:NOTES:END -->
