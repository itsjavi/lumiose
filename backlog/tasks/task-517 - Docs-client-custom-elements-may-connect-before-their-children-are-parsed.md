---
id: TASK-517
title: 'Docs: ?client custom elements may connect before their children are parsed'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-21 07:09'
labels:
  - docs
milestone: m-13
dependencies: []
priority: medium
ordinal: 511000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the itsjavi.com port (TASK-486, doc-11). A ?client script loads as <script type="module" async> in the head, so it can run before the parser reaches the elements it defines (a slow or streamed response, a cached script, a <Suspense> boundary streamed later). The parser then upgrades each element as it creates it, and connectedCallback runs before the element's children exist. The local-time example in guides/web-components.md ("Server data in attributes") sets textContent in connectedCallback: with the HTML streamed after a 400 ms pause, it had 0 children at connect and ended as "Oct 21, 20262026-10-21" (the parser appended the server text after the script's). The port's elements avoid it by listening on the element itself (events bubble from children added later) and looking parts up when an event needs them. A related note for the same pages: elements a ?client script creates carry no scope, so the component's scoped CSS does not reach them (LUM3005 warns); the port renders its search results on the server instead, and :deep() under a scoped ancestor also works.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 guides/web-components.md and concepts/islands.md say when connectedCallback can run before the children, and their examples work in that case (the local-time example no longer duplicates its text)
- [ ] #2 The same section says that elements created by the script are unscoped, and shows the two ways to style them (server-rendered markup or :deep())
- [ ] #3 A docs test or check covers the examples with a definition that loads before the body
<!-- AC:END -->
