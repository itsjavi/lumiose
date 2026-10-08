---
id: TASK-14
title: Implement server codegen and the hydrate walk
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 14:25'
labels: []
milestone: m-2
dependencies:
  - TASK-9
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
SSR must output strings with fused escaping and no instances. Hydration needs a separate claim walk that is tree-shaken when unused (spec §5.2-5.3, §7.4).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Server output uses sync-first ssr() with hoisted parts, escaping, and markers only inside island subtrees and async instance ranges
- [x] #2 The hydrate walk is a separate generated path, emitted only for modules reachable from island or SPA entries
- [x] #3 Golden fixtures for server and hydrate output
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Target-aware shared JSX visitor (codegen/client): props rewrite, list/branch/selector idioms, components and props objects are shared; target picks the runtime module (lumen/dom | lumen/server) and helper list.
2. Server builders (codegen/client/ssr.rs): elements/fragments/children become ssr(_sN, ...holes) with hoisted, deduplicated parts arrays. Static attrs + scope tokens + text baked into parts (same HTML rules as client templates, closing tags always written, implicit <tbody>, pre/textarea newline). Holes: attr/classAttr/styleAttr/spreadAttrs (+ $$scope via spreadAttrs when props.class is applied), text() exactly where the client uses setText, insert() where the client uses insert, list(source, render) and branch(cond, a, b) holes directly. Events, refs, attach dropped; bind:value/checked -> attributes; innerHTML/textContent/textarea value -> content.
3. compile(): remove the LUM1002 server stub. Hydrate walk: per doc-2 §1 there is no separate generated walk; document the server/client structural correspondence for Spark (TASK-18).
4. Goldens: every client fixture also compiles to <stem>.server.js (tests/server_golden.rs) + server-specific fixtures.
5. Vitest (packages/compiler/test/server.test.ts): compile server modules, renderToString and compare HTML; client-vs-server parity (server HTML parsed vs client DOM).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (from Nova's TASK-16 server runtime, now implemented in packages/lumen/src/server):
- String holes are trusted raw HTML, so emit them only through the helpers. A plain {t} object is escaped; rendered HTML is the branded SSRHtml.
- Adjacent dynamic texts: put an empty static part "" between two text() holes, and the runtime emits <!--!--> inside islands.
- Use insert() wherever the client uses insert, so island markers match. list and branch are holes directly.
- Attribute helpers return strings with a leading space. $$scope goes through spreadAttrs; event handlers are dropped on the server.
- JSX-valued island props go in slots and are left out of props.

Photon (from TASK-9): the client codegen spells out the <tbody> the HTML parser inserts for <tr> children of <table> (walks must match the parsed DOM); server output must emit the same. compile() returns LUM1002 for target server until this task lands (crates/lumen_compiler/src/compile.rs). Client codegen is a VisitMut in codegen/client; template.rs/children.rs decide <!> markers (between text and text, or before another dynamic part; otherwise the next static sibling; last part appends), which the hydrate walk must mirror.

Photon (TASK-14 done):
- Design: one target-aware JSX visitor (crates/lumen_compiler/src/codegen/client/mod.rs, TransformOptions.target). Components/props objects, props destructuring, list/branch/selector idioms are shared; server builders are in codegen/client/ssr.rs. compile() no longer returns LUM1002 for target server.
- Server output: ssr(_sN, ...holes) with hoisted, deduplicated parts arrays (_sN). Holes: insert() wherever the client calls insert, list(source, render)/branch(cond, a, b?) directly, text() exactly where the client uses setText (sole text-like child), attr/classAttr/styleAttr/spreadAttrs/escape for attributes and content props. Static HTML equals the client template's (normalisation, implicit <tbody> with scope tokens, pre/textarea newline) but closing tags are always written and the client's <!> placeholders are never emitted. Attribute order = client DOM order (static + baked class/style, scope tokens, dynamic in source order). props.class applied -> classAttr(...) + spreadAttrs({ $$scope: props.$$scope }). Events/on:/ref/attach/key/client:* dropped; bind:value/bind:checked -> attr(name, sig()); innerHTML -> raw content; textContent/innerText/<textarea value> -> escape() content.
- Hydrate walk: per doc-2 §1 (amended) there is no generated hydrate path; hydration reuses the client walk via the runtime claim cursor (TASK-18). Correspondence Spark needs: inside islands, each client insert/list/branch op is exactly one <!--[-->…<!--]--> (or <!--[!-->) region in the server HTML, in the same child order; the client template's <!> (placed between text and text, or before another dynamic part) has no server node — it sits right after the region whose op uses it as marker; text() (client setText on a ' ' text node) has no wrapper and renders nothing for '' (the hydrator must create the text node). The template content is enough to reconcile (walk template children and server children in parallel, skipping regions).
- Client fix: <textarea value="literal"> is now assigned as a property (it was baked as an attribute, which has no effect).
- Open issue (pre-existing, client+server): rows rendered directly in <table> from a .map() (no <tbody>) are table>tr on the client but table>tbody>tr once the server HTML is parsed. Proposal: warning diagnostic or wrap; not done here.
- Evidence: cargo test -p lumen_compiler (codegen_golden: client_goldens + server_goldens over 21 fixtures incl. new ssr-attributes.tsx; compile_api server_target_imports_lumen_server), clippy clean; packages/compiler/test/server.test.ts 11 tests: renderToString output for doc-2 §5.1-5.3, attributes/escaping, structure; island markers via island(); client/server parity (server HTML parsed by happy-dom == mounted client DOM, comments stripped) for 5 sources. pnpm typecheck clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Server target of compile(): JSX compiles to sync-first ssr(parts, ...holes) on lumen/server with hoisted parts, fused escaping via the runtime helpers, and hydration markers decided by the runtime inside islands only. Shares the client visitor so dynamic regions line up with the client walk; hydration reuses the client walk (doc-2 §1 amendment, AC#2). Goldens for every fixture in both targets; Vitest execution, island-marker and client/server parity tests.
<!-- SECTION:FINAL_SUMMARY:END -->
