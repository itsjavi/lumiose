---
id: TASK-337
title: 'SSR: leave object and array props of custom elements out of the HTML'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-15 05:23'
updated_date: '2026-10-15 05:39'
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
- [ ] #1 Server HTML of a custom element omits object, array and function prop values; strings, numbers and true stay attributes
- [ ] #2 Built-in elements are unchanged (a URL object in href still renders its string)
- [ ] #3 The web components guide no longer mentions the text attributes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Lux): routed to Photon (the compiler marks custom-element props) in coordination with Nova (server rendering of those props); part of the M11 run after TASK-326.
<!-- SECTION:NOTES:END -->
