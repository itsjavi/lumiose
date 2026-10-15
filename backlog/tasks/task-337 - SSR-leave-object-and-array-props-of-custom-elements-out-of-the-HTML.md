---
id: TASK-337
title: 'SSR: leave object and array props of custom elements out of the HTML'
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-15 05:23'
updated_date: '2026-10-15 06:44'
labels:
  - ssr
  - compiler
milestone: m-11
dependencies: []
priority: low
ordinal: 339000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-326 (Spark). On the client, props of a custom element that defines a property of that name go to the property (React 19's rule, packages/lumiose/src/dom/attributes.ts). On the server, the compiler emits attr(name, value) without knowing the tag, so arrays render as text (labels="a,b") and objects as "[object Object]" in the HTML until the island hydrates and sets the property. React 19 leaves object, array and function values of custom elements out of the server HTML (primitives stay attributes). Needs the compiler (Photon) to mark props of custom-element tags (a flag or a helper such as ceAttr) and the server runtime (Nova, packages/lumiose/src/server/attrs.ts) to skip non-primitive values for them; URL objects (String(url)) on built-in elements must keep working. Update docs/guides/web-components.md (Server rendering) when done.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Server HTML of a custom element omits object, array and function prop values; strings, numbers and true stay attributes
- [x] #2 Built-in elements are unchanged (a URL object in href still renders its string)
- [x] #3 The web components guide no longer mentions the text attributes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Lux): routed to Photon (the compiler marks custom-element props) in coordination with Nova (server rendering of those props); part of the M11 run after TASK-326.

2026-10-15 (Lux, orchestrator): reassigned to Spark for the unattended M10/M11 run. New worker sessions cannot be started from automated turns, and Spark's session was idle with its own queue done; Spark may edit this task's area (crates, CI workflows, release scripts) for it, since no Photon or Halo worker is active.

Spark started 2026-10-15 (batch 5).

Implementation (Spark, batch 5):
- Compiler (crates/lumiose_compiler/src/codegen/client/ssr.rs): on a custom-element tag (a dash, annotation-xml aside), a dynamic attribute compiles to attr(name, value, true) and a spread to spreadAttrs(props, true). Other elements keep the two-argument calls, so their output is unchanged (no golden changed). Test: tests/compile_api.rs server_attributes_of_custom_elements_leave_objects_to_the_client.
- Server runtime (packages/lumiose/src/server/attrs.ts, Nova's area, a guarded third parameter only): attr(name, value, custom) returns '' for objects (arrays included) when custom, as React 19 does; spreadAttrs passes it on. Strings, numbers and true stay attributes; built-in elements are unchanged (a URL object in href still renders its string). Tests: server/parity.test.ts (custom element attributes), dom/hydrate.test.ts (the server HTML of a hydrated custom element has no 'items' attribute, and the island sets the property).
- Docs: guides/web-components.md (Server rendering) no longer mentions the text attributes.
- For Lux: the compiler-runtime contract (doc-2 §3) lists attr and spreadAttrs by name only; their optional third argument (custom element) could be noted there.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Server HTML of a custom element now leaves object, array and function props out (React 19's rule): the compiler passes a custom-element flag to attr() and spreadAttrs(), and the island sets those values as properties when it hydrates. Built-in elements are unchanged.
<!-- SECTION:FINAL_SUMMARY:END -->
