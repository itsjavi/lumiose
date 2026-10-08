---
id: TASK-14
title: Implement server codegen and the hydrate walk
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 14:10'
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
