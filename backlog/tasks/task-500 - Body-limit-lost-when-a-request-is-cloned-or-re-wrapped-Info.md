---
id: TASK-500
title: Body limit lost when a request is cloned or re-wrapped (Info)
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-20 23:55'
labels:
  - security
dependencies: []
priority: low
ordinal: 496000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Delta review finding S3 (TASK-472 L4 partly closed): packages/lumiose/src/app/server/body.ts:114 sets the json()/text() overrides as own properties, so request.clone().json() or new Request(request).json() with a multipart Content-Type reads past the 1 MB limit up to the upload limit. Keep the flag in a WeakMap keyed by the body stream, or document the limitation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Either clones keep the limit (test) or the docs state it
<!-- AC:END -->
