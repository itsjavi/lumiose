---
id: TASK-234
title: 'Hydration: inserted children before static elements in a conditional fragment'
status: Done
assignee:
  - Photon
created_date: '2026-10-11 02:43'
updated_date: '2026-10-11 03:02'
labels:
  - compiler
  - hydration
milestone: m-7
dependencies: []
priority: high
ordinal: 236000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Chime in TASK-218 (repro and details in its notes). For a fragment inside a conditional where inserted children come before static elements, for example cond ? <>{item("a")}{item("b")}<label>static</label></> : null, the client code creates the static element before the inserted children render, so it claims item("a")'s server node. The server also writes no block markers for inserts inside the fragment. Result: LUM4006, and the whole SPA island renders again on the client. Dotmatrix works around it with a display: contents div in InstrumentPanel; remove the workaround once fixed (Chime's area, so coordinate). Fix the compiler output (claim order, server markers) and/or the hydration claim cursor. The repro compiles through compile() in packages/compiler in about 10 lines.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The repro hydrates without LUM4006 or a full re-render, in client and server output, with a regression test in the compiler and an e2e hydration test
- [x] #2 Similar shapes are covered by tests: inserts after static elements, nested fragments, .map inside a conditional fragment
- [x] #3 Dotmatrix's display: contents workaround is removed by its owner, with its e2e passing
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon, 2026-10-11 (commits fd9bbce, 10f7e50).

**Root cause (compiler, both targets).** In an array of renderables (a fragment or component children with more than one item), the client created every static root first, as one multi-root template in the setup, and evaluated dynamic items afterwards as thunks resolved by the consumer's region. Hydration claims positionally inside a region, so `_t1()` (the `<label>`) claimed `item("a")`'s `<span>`. The server also wrote the dynamic items without island blocks, so their extent (text, nodes, nothing) was unknown to the client. The same happened to any dynamic item before a static one, to `.map`/conditionals before statics (`listValue`/`branchValue` were evaluated after the template), and to text followed by claiming content (`<Card>Footer {x()}</Card>` only worked because nothing claimed).

**Fix (doc-2 updated: `insertValue` rows, §3.1 marker table, "Arrays of renderables" alignment rule).**
- Client codegen (`compile_fragment_items`): items are created in document order. Each run of static items (text included, so it claims its server text node) is a template of its own; components and JSX compile in place; a value that creates nodes is bound to a `const` before later creation code; other dynamic items become `insertValue(value)` (tracked like `insert`). Single-item fragments are unchanged.
- Server codegen (`ssr_fragment_items`): in arrays, the same items become `insertValue(value)`, which writes the island block `<!--[-->…<!--]-->`.
- Runtime (minimal, authorized by Lux): `lumiose/dom` `insertValue(value)` = `renderRange(value, 1)`: a parentless range that claims the next server block, like `branchValue`/`listValue`. `lumiose/server` `insertValue(v)` = `insert(v)` as an SSRNode (an array escapes plain strings). Contract types and contract tests updated (contract/client.ts, contract/server.ts are Lux's; dom/server are Spark's/Nova's).

**Tests.**
- Compiler golden `tests/fixtures/client/fragment-claim-order.tsx` (both targets): the repro, inserts after statics, interleaved components, nested fragments, `.map` in a conditional fragment, text plus inserts, component children text plus insert, single insert. `fragments` and `values` goldens updated (order fixes).
- `packages/lumiose/src/dom/hydrate.test.ts` "hydrate: arrays of renderables (TASK-234)": real compiler output, server HTML, then hydrate; asserts no LUM4006, every server element kept its identity, and updates after hydration (toggle, list update, text update). Fails with the old compiler (LUM4006 in all three cases).
- e2e: examples/ssg-spa-e2e Home has the repro shape; a new spec checks the prerendered page hydrates with no warnings and no removed `frag-` elements (MutationObserver), then toggles. Dev and build projects.

**Validation.** `cargo test --workspace` green; `cargo clippy -p lumiose_compiler --all-targets` clean; packages/lumiose vitest 71 files / 798 tests green; packages/vite 139 green; packages/compiler 45 green; tsc for packages/lumiose clean; ssg-spa-e2e 17 passed (1 skipped by design); islands-e2e 5 passed; js-framework-benchmark builds (its output does not use `insertValue`, so it is unchanged in shape); WASM compiler (`lumiose_wasm`, wasm32-unknown-unknown) builds and includes the change; napi rebuilt.

**AC #3 (Chime, not done here).** In examples/spa-dotmatrix/src/ui/InstrumentPanel.stsx, replace `<div class="pitched">…</div>` (around line 198) with a fragment `<>…</>`, delete the comment above it, and delete the `.pitched { display: contents; }` rule in the `<style>` block; then run Dotmatrix's e2e (dev and preview), which already fails on console errors and checks in-place hydration.

Chime: removed the .pitched div workaround in examples/spa-dotmatrix InstrumentPanel; the pitched fields are a fragment again. lumiose check, unit tests (221) and Playwright dev+preview (66/66, fails on console errors/LUM warnings) pass; instrument panel screenshots pixel-identical before/after.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Arrays of renderables (fragments, component children) are now created in document order on the client, and their dynamic items are insertValue ranges that claim insertValue island blocks written by the server, so the TASK-218 shape and similar ones (inserts after statics, nested fragments, .map or text with inserts) hydrate in place without LUM4006. New insertValue helper in lumiose/dom and lumiose/server; doc-2 updated. Compiler goldens, dom hydration tests and an ssg-spa-e2e spec cover it. AC #3 (removing Dotmatrix's display: contents workaround) is left to Chime.
<!-- SECTION:FINAL_SUMMARY:END -->
