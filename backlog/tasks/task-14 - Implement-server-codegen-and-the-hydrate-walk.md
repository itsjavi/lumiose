---
id: TASK-14
title: Implement server codegen and the hydrate walk
status: In Progress
assignee:
  - '@Photon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 14:17'
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
- [ ] #1 Server output uses sync-first ssr() with hoisted parts, escaping, and markers only inside island subtrees and async instance ranges
- [ ] #2 The hydrate walk is a separate generated path, emitted only for modules reachable from island or SPA entries
- [ ] #3 Golden fixtures for server and hydrate output
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
<!-- SECTION:NOTES:END -->
