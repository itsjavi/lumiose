---
id: TASK-103
title: Island records land after </html> with a custom document.stsx
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-08 22:17'
updated_date: '2026-10-08 22:21'
labels: []
milestone: m-2
dependencies:
  - TASK-36
priority: high
ordinal: 103000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spark found (TASK-25 notes) that when an app has a custom document.stsx, the streamed island records script is appended after </html>. Browsers tolerate it, but it is invalid HTML and fragile for streaming.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Island records, loader script and streamed chunks are emitted before </body> (or inside body for streamed chunks) with both the default and a custom document; tests for both, including streaming
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. server/render.ts: internal renderShell() returns the shell HTML and its island records apart; renderToStream keeps body = html + records (public API unchanged).
2. app/server/render.ts createServerRenderer: with a custom document, place the shell records just before the body marker (so before the stream and </body>); default document unchanged.
3. Tests (server-renderer.test.ts): default + custom document, shell islands and streamed islands, loader placement, nothing after </html>.
4. Docs: note placement in concepts/document docs if they describe it.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (nova-20261008T221802Z): claimed.

Nova: fixed. server/render.ts gains an internal renderShell() returning { head, html, records, stream }; renderToStream keeps body = html + records (public API unchanged). The app renderer (app/server/render.ts createServerRenderer) puts the shell records just before the custom document's body marker, where the stream is spliced in, so records precede streamed chunks and </body>. The loader goes in the head (shell islands) or the first streamed chunk with islands, as before; both stay inside the document.
Evidence: server-renderer.test.ts 'island records and the loader stay inside the document (TASK-103)': default + custom document x (shell islands + streamed boundary, streamed island bringing the loader + records, prerender); each asserts exact placement and that nothing follows </body></html>. The two custom-document cases fail without the fix. Docs: concepts/head.md (Document paragraph), llms-full regenerated. pnpm typecheck, pnpm test (1031 passed), pnpm lint clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Island records of the shell now land before the custom document's body end (before the streamed chunks) instead of after </html>; default documents unchanged. Internal renderShell() keeps records apart; renderToStream's public shape is unchanged. Tests cover default and custom documents with shell, streamed and prerendered islands.
<!-- SECTION:FINAL_SUMMARY:END -->
