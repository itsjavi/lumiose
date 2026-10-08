---
id: TASK-90
title: 'Runtime: text fast path with insert fallback'
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-08 21:05'
updated_date: '2026-10-08 22:27'
labels: []
milestone: m-1
dependencies:
  - TASK-13
priority: medium
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Photon's TASK-65 can compile benchmark-style rows ({id}, {row.label()}) to text nodes only if the runtime offers a helper that is a plain text write for strings/numbers and falls back to insert semantics otherwise (option A in the TASK-65 notes). Lux approved option A.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumen/dom exports insertText(parent, value, marker) (or an equivalent name), contract doc-2 and client.ts updated via a note to Lux: strings/numbers go to a single text node (data write on change), other values fall back to insert reconciliation; reactive sources bind once
- [x] #2 Hydration claims the server text() hole for the fast path (no LUM4006); server text() parity; tests; size delta ≤ 120 B brotli
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Client helper in dom/insert.ts, applied to the template text node (the provable-text path's placeholder): text fast path, bind once for functions, insert-region fallback claimed under hydration.
2. Server helper in server/ssr.ts: text() for text values, insert() otherwise.
3. Contract entries (client.ts/server.ts, contract tests), doc-2 text proposed to Lux; codegen guidance for Photon (TASK-65).
4. Tests (unit, server parity, hydration with hand-compiled islands), size delta.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (2026-10-09): Commit 0bb03a9.
Shape: insertText(node: Text, value) instead of insertText(parent, value, marker): the child keeps the template text node of the provable-text path (cloned with the row, no createTextNode, no region), so a reactive child is one render effect: insertText(_t, () => row.label()) = bind(_t, getter, applyText), like the hand-compiled bind(_a.firstChild, row.label, setText); a signal passed as is (insertText(_t, count)) binds without a closure. Values: string/number/bigint -> data; null/undefined/boolean -> ""; function -> bound once, each value applied the same way; anything else (Node, array, fragment, a function returned by the getter) -> insert semantics in a region before the text node (marker = the text node, which stays empty), reverting to text values inside that region afterwards; the fallback's content owner is disposed on each new value.
Server: lumen/server insertText(value) unwraps functions; objects (SSR nodes, arrays, promises) -> insert() (island block), everything else -> text() (TextHole, so <!--!--> separators apply).
Hydration: the template walk claims the server text (or creates an empty node where the server rendered none); a fallback opens createRegion(parent, textNode), which finds the hole walk() keyed by that text node (the block before a template text node is moved aside and re-inserted before its marker). Tests: dom/insert-text.test.ts (static values, binding, fallback to node/array/nested function and back, cleanup, server parity with text(), hydration of text/number/null keeping the server text node, a block fallback keeping the server <b>, a live binding after hydration; no LUM4006 warning).
Size (min+brotli, size.ts entries + insertText): typical app imports 6178 -> 6237 (+59 B); benchmark imports (no insert) 5398 -> 5490 (+92 B); <= 120 B.
For Lux (contract owner): I added the members to contract/client.ts and contract/server.ts (and the contract tests' key lists) so the tree stays green; please carry them into doc-2: §2 Dynamic content: 'insertText(node: Text, value: Renderable): a child that may be text, at a text node of the template: strings/numbers set its data, nullish/booleans empty it, a function is bound once (values applied the same way), other values (nodes, arrays, nested functions) render like insert() in a region before the text node.' Server: 'insertText(value): text() for text values (incl. nullish/booleans), insert() for objects.' §3 Template/server alignment: 'A maybe-text child alone between nodes (same rule as provable text) is a client template text node written by insertText and a server insertText() hole; a non-text value renders as an insert() block inside islands, which the client claims as a region whose marker is the text node.'
For Photon (TASK-65): emit, for children that are not provably text but are isolated (the is_isolated rule of the text path; never next to JSX text or another dynamic child): client template text placeholder + insertText(_text, value) (reactive: insertText(_text, () => expr), or the signal itself when the child is a bare identifier/getter), server insertText(expr) in place of insert(expr)/text(expr). Sole children (<span>{id}</span>) qualify too.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen/dom insertText(node, value) writes a maybe-text child into its template text node: strings and numbers set the data (no region), nullish/booleans empty it, a function binds once, and other values fall back to insert semantics in a region before the node; lumen/server insertText(value) renders text() or insert() accordingly, and hydration claims the server text (or the server block for a fallback) with no LUM4006. Size delta +59 B (typical imports) / +92 B (benchmark imports) brotli. Contract members added to client.ts/server.ts; doc-2 wording and the codegen rule for Photon (TASK-65) are in the notes. Commit 0bb03a9. Validation: pnpm typecheck, pnpm lint, dom/server/contract tests (289 passed), full pnpm test.
<!-- SECTION:FINAL_SUMMARY:END -->
