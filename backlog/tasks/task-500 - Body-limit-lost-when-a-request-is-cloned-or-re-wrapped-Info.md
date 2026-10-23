---
id: TASK-500
title: Body limit lost when a request is cloned or re-wrapped (Info)
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-20 23:55'
updated_date: '2026-10-23 08:51'
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
- [x] #1 Either clones keep the limit (test) or the docs state it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
A WeakMap keyed by the body stream cannot work: clone() tees into two new streams and new Request(request) proxies the body through a new one (checked in Node 26). The bounded request now overrides clone() too, so clones (of clones) get the same json()/text() switch, which shares one flag with the upstream bounded stream.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
request.clone() of a bounded request keeps the 1 MB body limit for json() and text() of a body declared multipart: clone() is overridden to give the clone the same json()/text() overrides, sharing the flag of the bounded stream upstream of the tee. new Request(request) cannot be intercepted, so concepts/security.md states that a re-wrapped request keeps only the Content-Type's limit. Test: body.property.test.ts reads through 0 to 2 clones (fails without the fix).
<!-- SECTION:FINAL_SUMMARY:END -->
