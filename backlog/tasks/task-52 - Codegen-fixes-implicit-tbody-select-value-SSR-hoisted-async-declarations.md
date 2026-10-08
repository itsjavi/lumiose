---
id: TASK-52
title: 'Codegen fixes: implicit tbody, select value SSR, hoisted async declarations'
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 15:30'
updated_date: '2026-10-08 16:13'
labels: []
milestone: m-2
dependencies:
  - TASK-15
priority: medium
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Photon's TASK-14/15 report found three issues: rows rendered directly in <table> hydrate wrongly (the parser inserts tbody), <select value> isn't reflected in SSR, and $async wrapping turned async component declarations into non-hoisted consts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Direct <tr> children and row-producing .map()/branches of <table> are wrapped in an implicit <tbody> in both client templates and server output (HTML parsing semantics); fixtures
- [x] #2 <select value={v}> marks the matching <option> as selected in SSR output, for static and .map()-generated options; fixtures
- [x] #3 Async component function declarations stay hoisted: emit async function X(){…} plus $async(X) instead of a const; fixtures
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Group row children of <table> (static <tr>, row-rendering .map()/conditionals) into one implicit <tbody> group on both targets. 2. Server: <select value> → local + attr('selected', …) on options (static, optgroup, .map()); client: set the select value after its options. 3. Async declarations stay hoisted with a $async(X) tag at the start of the scope. 4. Goldens + Vitest (server render, parity, client execution).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (session photon-task45-20261008T153134Z) claimed TASK-52.

## Implementation (Photon)

- **Implicit `<tbody>`** (codegen/client/children.rs `group_table_rows`, used by both targets): consecutive row children of a `<table>` — `<tr>` elements and expressions rendering `<tr>`s (`.map()` callbacks with expression or block bodies, conditionals, `&&`) — become one `Item::Rows` group; the client template spells out `<tbody>` (with the scope tokens) and the group's list/branch/insert ops use it as parent (markers computed within the group); the server writes `<tbody>…</tbody>` around the same items. `<caption>`, `<thead>`, `<tfoot>`, an explicit `<tbody>`, text or a component end a group. The existing `lists` golden had exactly this bug (`list(_table, …)` → `list(_tbody, …)`).
- **`<select value>` SSR** (codegen/client/ssr.rs): a `<select>` with `value={v}` / `value="x"` / `bind:value={sig}` (no spread) declares `const _selected = v;` in the template's setup and drops the meaningless `value` attribute; every `<option>` compiled inside it (static, in optgroups, or in `.map()` callbacks) gets `attr("selected", String(_selected) === <value>)`, its value being its `value` attribute (`String(expr)` for expressions) or its static text (whitespace stripped/collapsed). Options with their own `selected` or an unknown value are left alone. Client fix in the same spirit: a select's `value`/`bind:value` op is now emitted after its children's ops, so the value is set once the options exist (it was the known TASK-9 limitation: set before `.map()` options were inserted).
- **Hoisted async declarations** (codegen/client/asyncs.rs): `async function X` (plain, `export`, named `export default`) stays a declaration, visited in place, and a `$async(X);` statement goes at the start of the enclosing statement list (after imports), so X is tagged before any code of the scope can render it, even code above the declaration. Anonymous `export default async function` keeps `export default $async(async function …)`. The tag statement is not `@__PURE__` (it mutates X): unused async component declarations are no longer tree-shaken (previously a pure-annotated const).

**Evidence.** Goldens: new `implicit-tbody.tsx` (mapped, mixed with caption/thead/static/mapped block body/ternary/&&/tfoot, explicit tbody) and `select-value.tsx` (static options, text value, own `selected`, optgroup, mapped options, bind:value) for both targets; `async-components` and `doc2-async` now show hoisted declarations; `lists` fixed. Vitest: server render of a table with mapped + conditional rows (`<table><tbody>…`) and selects (mapped option selected, text-valued option selected); client/server parity for the same component (selectedness normalized through select.value / parsed `selected`, since happy-dom applies neither number values nor parsed `selected` reliably); client execution (rows under `table > tbody`, select.value right after mount and after a change, a row added); async: `export const early = Late` above `async function Late` is defined and tagged. cargo test/clippy/fmt clean; WASI rebuilt, parity passes; pnpm typecheck clean; pnpm test 820/822 — the 2 failures are Beacon's in-progress docs (packages/lumen/src/cli/docs: stale llms-full.txt after a styles.md edit, and a docs example exporting POST from a static endpoint → Nova's new LUM5005), unrelated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rows of a <table> (static <tr>s, row-rendering .map() calls and conditionals) are grouped into the implicit <tbody> the HTML parser creates, in client templates (ops target the tbody) and server output alike. <select value> (and bind:value) marks the matching <option> selected in SSR output for static, optgroup and .map()-generated options, and the client now sets the select value after its options exist. Async component declarations stay hoisted async functions, tagged by a $async(X) statement at the start of their scope. Covered by new goldens (implicit-tbody, select-value, updated async/lists) and Vitest server rendering, client/server parity and client execution tests.
<!-- SECTION:FINAL_SUMMARY:END -->
