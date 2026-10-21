---
id: TASK-510
title: >-
  Language server tests: closing the server can outlast the hook timeout on
  Windows
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-21 04:57'
updated_date: '2026-10-21 04:59'
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
- [ ] #1 TestServer.close() waits at most 3 s for the shutdown answer and 2 s for the exit, then kills the process, and its rm retries on busy files
- [ ] #2 The language-server project's hooks get 30 s
- [ ] #3 The language-server tests pass locally 5 times, also under CPU load
<!-- AC:END -->
