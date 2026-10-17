---
id: TASK-476
title: >-
  Static files: open the file on first read, so an unread response can't leak a
  handle
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-16 23:48'
updated_date: '2026-10-17 00:52'
labels:
  - server
  - bug
dependencies: []
priority: high
ordinal: 474000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found at the 2026-10-17 merge: pnpm check failed with 11 unhandled 'A FileHandle object was closed during garbage collection' errors (ERR_INVALID_STATE) from packages/lumiose/src/app/server/static-fs.test.ts. On Node 26 that is no longer a deprecation warning but an uncaught exception. static-fs.ts opens a FileHandle when it builds the Response (line ~99), and fileStream closes it only at the end of the stream or when it is cancelled. A Response whose body is never read or cancelled keeps the handle until garbage collection, which then throws. That happens when a test reads only the headers, when middleware replaces the response, or when an adapter drops the body. In a server that can crash the process. Fix: check that the file exists without holding it (for example with stat or access), open it in the stream's first pull, and close it on end, error and cancel. Add a test that drops an unread static Response and forces a GC (node --expose-gc, or a FinalizationRegistry probe) with no error, and check that adapter-node cancels the body on a client abort.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An unread static Response holds no file handle, with a test that fails before the fix
- [x] #2 Bodies are read, ended, cancelled and errored with no leaked handle, and the file is still answered by the app when it was removed after the index was built
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-17): claimed, branch claude/nova-css-0fc0df.

Nova (2026-10-17): fix in c48b2b81. static-fs.ts checks the file with access() (a file removed after the index was built still goes to the app), and fileStream opens it on the first read and closes it at the end, on error and on cancel. The stream needs highWaterMark 0: with the default 1 it pulls right after construction, so the first attempt still opened every file eagerly (the GC test caught it). Tests (static-fs.test.ts): unread responses + forced GC (v8 --expose-gc via setFlagsFromString) report no ERR_INVALID_STATE, and fail before the fix with one error per handle; read, cancelled after a chunk, cancelled before any, failing (file removed after the response was made); removed after indexing → 418 (the app). adapter-node: sendWebResponse (lumiose app/server/node-http.ts, which adapter-node and dev use) cancels on the response's close; it now also cancels when the write loop finds the response destroyed before close fired. New node-http test: a body that keeps streaming is cancelled on a client abort. adapter-node's own static files use createReadStream, destroyed on close: no FileHandle.

Validation (Nova, 2026-10-17): pnpm check exit 0 (2549 tests); pnpm pack:check --smoke --skip-npm exit 0; Playwright: apps/web 179 passed, ssg-spa-e2e 19, ssg-travel-journal 17, ssr-auth 6, ssr-bookshelf 17, ssr-i18n-i18next 5, ssr-i18n-paraglide 5, ssr-realtime 9, ssr-styles-e2e 10.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Static files open on the first read (stream highWaterMark 0) after an access() check, and close at the end, on error and on cancel, so an unread Response holds no FileHandle; a GC test fails before the fix. sendWebResponse also cancels a body when it finds the response destroyed before its close event. Commit c48b2b81.
<!-- SECTION:FINAL_SUMMARY:END -->
