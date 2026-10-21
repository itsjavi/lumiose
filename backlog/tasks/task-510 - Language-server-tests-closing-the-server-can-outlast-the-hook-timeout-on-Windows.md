---
id: TASK-510
title: >-
  Language server tests: closing the server can outlast the hook timeout on
  Windows
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-21 04:57'
updated_date: '2026-10-21 05:48'
labels:
  - test
dependencies: []
priority: high
ordinal: 506000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Flaky in CI check (windows), 2 of 6 runs (38793766243, 39047144800): packages/language-server/src/server.test.ts 'language server (pull diagnostics)' fails with 'Hook timed out in 10000ms' in afterAll(() => server?.close()) after every test passed. TestServer.close() (src/test-client.ts) awaits the 'shutdown' request without a bound; the server answers it only once TypeScript 7's own shutdown returns, which a busy TypeScript server on a loaded 4-core Windows runner can delay past the 10 s default hook timeout. Editors bound it (vscode-languageclient waits 2 s, then kills). Not reproducible on macOS; the fix bounds each step of close() and gives the hooks the tests' 30 s, as the hooks start and stop real TypeScript servers. Windows also keeps a killed process's files busy for a moment, so the temp workspace's removal retries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 TestServer.close() waits at most 3 s for the shutdown answer and 2 s for the exit, then kills the process, and its rm retries on busy files
- [x] #2 The language-server project's hooks get 30 s
- [x] #3 The language-server tests pass locally 5 times, also under CPU load
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-21 (Beacon): Windows cannot be run here, so the mechanism was checked on macOS by freezing the TypeScript child (SIGSTOP) so its shutdown never answers: the old close() was still waiting after 20 s, the new one returned in 3.0 s. Changes in src/test-client.ts and vitest.config.ts: close() waits at most 3 s for the shutdown answer and 2 s for the exit, then kills the child; rm retries busy files 10 times; hookTimeout is 30 s. The language-server tests passed 5 times under CPU load, and pnpm check passes. Not verified on Windows until CI runs.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TestServer.close() is bounded (3 s shutdown, 2 s exit, then kill; rm retries busy files) and the hooks get 30 s. A server whose TypeScript never answers shutdown now closes in about 3 s instead of hanging past the hook timeout. Windows is verified only by the next CI run.
<!-- SECTION:FINAL_SUMMARY:END -->
