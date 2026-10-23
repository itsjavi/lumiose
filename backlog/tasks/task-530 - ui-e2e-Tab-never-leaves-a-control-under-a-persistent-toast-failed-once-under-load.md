---
id: TASK-530
title: >-
  ui-e2e: 'Tab never leaves a control under a persistent toast' failed once
  under load
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-23 09:54'
labels:
  - test
dependencies: []
priority: low
ordinal: 523000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
examples/ui-e2e/e2e/toast.e2e.ts:313 (build project) counted one focused control under the toast viewport (covered 1, expected 0) in a full ui-e2e run right after pnpm check on 2026-10-23 (1023 passed, 1 failed). The toast file passed 5 repeats in a row alone (225/225), and the test 3/3. It reads the focused element's rect right after each Tab, which may land before the page's scroll-into-view settles under load. Per decision-76, find the cause: wait for scroll to settle (or read after a frame), or check scroll-padding against the toast stack, instead of retrying.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The test waits on a real condition and passes 20 repeats of the toast file under CPU load
<!-- AC:END -->
