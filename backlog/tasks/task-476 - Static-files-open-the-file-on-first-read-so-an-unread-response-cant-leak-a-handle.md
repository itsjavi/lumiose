---
id: TASK-476
title: >-
  Static files: open the file on first read, so an unread response can't leak a
  handle
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-16 23:48'
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
- [ ] #1 An unread static Response holds no file handle, with a test that fails before the fix
- [ ] #2 Bodies are read, ended, cancelled and errored with no leaked handle, and the file is still answered by the app when it was removed after the index was built
<!-- AC:END -->
