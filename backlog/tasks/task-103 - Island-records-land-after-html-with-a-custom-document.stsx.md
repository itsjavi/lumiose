---
id: TASK-103
title: Island records land after </html> with a custom document.stsx
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 22:17'
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
- [ ] #1 Island records, loader script and streamed chunks are emitted before </body> (or inside body for streamed chunks) with both the default and a custom document; tests for both, including streaming
<!-- AC:END -->
