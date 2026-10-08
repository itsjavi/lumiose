---
id: TASK-95
title: 'lumen preview and adapter-node: honour configured response headers'
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-08 21:43'
updated_date: '2026-10-08 22:16'
labels: []
milestone: m-3
dependencies:
  - TASK-26
priority: medium
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spark found (TASK-72) that lumen preview serves the chiptune's static shells without the COOP/COEP headers configured for Vite dev, so audio falls back to postMessage instead of SharedArrayBuffer. Apps need a way to set response headers for static assets and shells in preview and production.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumen preview applies Vite's preview.headers (falling back to server.headers), and adapter-node accepts a headers option (static + dynamic responses); documented in reference/adapter-node and reference/cli
- [x] #2 The chiptune runs crossOriginIsolated under lumen preview (Playwright check)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. adapter-node: HandlerOptions.headers (OutgoingHttpHeaders), set on every response before statics/app, so a response's own headers win.
2. lumen preview (app/production/command.ts startPreview): pass the resolved config.preview.headers (Vite already falls back to server.headers).
3. Chiptune: server.headers COOP/COEP in vite.config.ts (dev + preview), Playwright check of crossOriginIsolated in both projects.
4. Tests: adapter server test, preview command test; docs reference/adapter-node, reference/cli.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (session nova-20261008T215800Z):
- adapter-node: headers option on createHandler/createServer; applied with res.setHeader before statics and the app, so static files' cache-control/etag/content-type and the app's (response().setHeader, middleware) headers of the same name win — the same precedence as vite preview.
- lumen preview: startPreview passes config.preview.headers; Vite's resolvePreviewOptions already defaults it to server.headers (checked in vite 8.3.4).
- Chiptune (Spark's sample, minimal edits, agreed by Lux): vite.config.ts sets server.headers COOP/COEP (shared const), README paragraph updated (preview no longer serves shells without headers; deployments use createServer({ headers })); src/middleware.ts left as is (still covers server-rendered pages). New e2e 'the pages are cross-origin isolated' runs in the dev and preview projects.
- Evidence: adapter-node vitest 12/12 (new: COOP/COEP on a prerendered page, a public file, a server page, an endpoint and the 404; static cache-control and a page's own COEP win); command.test.ts 3/3 (new: server.headers on / and a server route; preview.headers replaces them); chiptune Playwright 16/16 (dev + preview, incl. isolation; the preview now plays with SharedArrayBuffer); curl on lumen preview shows COOP/COEP on static shells; typecheck clean for lumen, adapter-node, chiptune; oxlint/oxfmt clean on changed files; pnpm test 1024 passed, 1 failure in src/vite/css-manifest.test.ts that passes alone (concurrent compiler work, unrelated).
- Docs: reference/adapter-node (option, precedence, example), reference/cli (lumen preview headers); llms-full regenerated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen preview now sends Vite's preview.headers (defaulting to server.headers) on every response, static files included, through a new headers option of @lumen/adapter-node (createServer/createHandler), where a response's own headers win. The chiptune sets COOP/COEP in server.headers and is cross-origin isolated under lumen dev and lumen preview (Playwright check in both). Documented in reference/adapter-node and reference/cli.
<!-- SECTION:FINAL_SUMMARY:END -->
