---
id: TASK-124
title: 'Sample-app hygiene: href(), formatting, stale config'
status: Done
assignee:
  - Spark
created_date: '2026-10-09 04:20'
updated_date: '2026-10-09 04:35'
labels:
  - samples
dependencies: []
priority: low
ordinal: 124000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-38 finding 11. Samples are agent training material. Lux authorises edits in examples/ssr-bookshelf and examples/ssg-travel-journal for this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bookshelf links use href(); chiptune vite.config drops the obsolete test conditions; all example .stsx pass lumen fmt --check and pnpm check runs it for examples
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark: bookshelf builds every internal link, form action, redirect and fetch URL with href() (query strings appended); chiptune vite.config drops the test-only resolve.conditions (unit tests 10/10 without it); lumen fmt applied to islands-e2e, spa-chiptune, ssg-travel-journal, ssr-bookshelf and vite-counter; root pnpm fmt:examples (pnpm --filter ./examples/* exec lumen fmt --check) runs in pnpm check. Workaround: two multi-line CSS comments in ssg-travel-journal became one-line comments because lumen fmt re-indents multi-line CSS comments on every run (new task for Beacon). Validation: typecheck of all 5 examples, example vitest 89/89, Playwright bookshelf 14, chiptune 18, travel journal 16, islands-e2e 5, vite-counter build.
<!-- SECTION:NOTES:END -->
