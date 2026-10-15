---
id: TASK-328
title: 'Guide: Sentry'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 04:03'
updated_date: '2026-10-15 06:43'
labels:
  - docs
  - guide
milestone: m-11
dependencies:
  - TASK-298
  - TASK-299
priority: medium
ordinal: 330000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-57: error reporting to Sentry through onRequestError in instrumentation.server and onError in instrumentation.client (decision-49), with source maps.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The guide reports server and client errors to Sentry, with source maps
- [x] #2 Its examples are type-checked
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (batch 4): started.

Done. docs/guides/sentry.md (Guides): vite.config.ts with build.sourcemap hidden and sentryVitePlugin last (org/project/auth token from env, filesToDeleteAfterUpload); src/instrumentation.server.ts starts @sentry/node in register() and reports onRequestError errors with phase/route tags and url/method/digest extras; src/instrumentation.client.ts starts @sentry/browser at top level (PUBLIC_SENTRY_DSN) and reports onError errors with phase/route/island tags; production notes (serverless flush via waitUntil, strict CSP unaffected, release); common mistakes. How it was checked: a scratch Lumiose app with exactly these files, lumiose build and lumiose preview, with the DSNs pointed at a local stand-in for Sentry's envelope endpoint: a server render error arrived as one node event tagged phase=render route=/boom, an island render error arrived as one javascript event tagged phase=effect island=/src/components/Crash.stsx#Crash, both with debug_meta (debug IDs) for source maps; the build wrote 23 hidden source maps across the client and server bundles (no sourceMappingURL comments) and the plugin deleted them after the (skipped, tokenless) upload. Not run against a Sentry account, so the upload itself is unverified. Type-checked in the docs examples (links for @sentry/*, @lumiose/vite and vite added); checked that a wrong option fails.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Sentry guide: server errors from onRequestError, browser errors from onError, source maps of both builds via Sentry's Vite plugin; checked against a local Sentry ingest stand-in.
<!-- SECTION:FINAL_SUMMARY:END -->
