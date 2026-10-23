---
id: TASK-517
title: 'Docs: ?client custom elements may connect before their children are parsed'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-21 07:09'
updated_date: '2026-10-23 19:25'
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
- [x] #1 guides/web-components.md and concepts/islands.md say when connectedCallback can run before the children, and their examples work in that case (the local-time example no longer duplicates its text)
- [x] #2 The same section says that elements created by the script are unscoped, and shows the two ways to style them (server-rendered markup or :deep())
- [x] #3 A docs test or check covers the examples with a definition that loads before the body
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (0.6.1 cleanup): local-time now replaces its text on DOMContentLoaded while document.readyState is "loading" (private #format). New section guides/web-components.md#before-the-children-are-parsed: when connectedCallback runs before the children (async module script, slow/streamed response, cached script), the two patterns (listen on the element itself and look parts up when an event fires; wait for the parser before reading or replacing children), and that elements the script creates are unscoped (LUM3005), with a copy-code example that keeps the code as server markup and styles the script's button with .code-block :deep(button). concepts/islands.md: two bullets in the ?client list plus a comment in copy-button. Test: packages/cli/src/docs/custom-elements.test.ts runs the docs' local-time, copy-button and copy-code scripts in happy-dom, defined before the body (a simulated parser connects each element before its children while readyState is loading) and after it. Against the old local-time it fails with the reported "Oct 21, 20262026-10-21".
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The ?client docs explain that connectedCallback can run before the children exist and how to handle it, and their examples work in that case. guides/web-components.md: local-time waits for DOMContentLoaded while the document is loading (no more duplicated text); a new section 'Before the children are parsed' covers listening on the element itself, waiting for the parser, and unscoped script-created elements (server markup or :deep(), with a type-checked copy-code example). concepts/islands.md has the same guidance as two bullets. packages/cli/src/docs/custom-elements.test.ts runs the three docs scripts in happy-dom, defined before and after the body; it reproduces the original bug against the old example. Validated: CLI docs tests (examples type-check included), docs:gen/docs:check, CLI typecheck, oxlint.
<!-- SECTION:FINAL_SUMMARY:END -->
