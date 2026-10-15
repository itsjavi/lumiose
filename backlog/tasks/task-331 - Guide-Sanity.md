---
id: TASK-331
title: 'Guide: Sanity'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 04:03'
updated_date: '2026-10-15 06:00'
labels:
  - docs
  - guide
milestone: m-11
dependencies: []
priority: medium
ordinal: 333000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-57: Sanity content read in async components, previews of drafts, and rebuilding static pages when content changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The guide covers reading content, draft previews and static rebuilds
- [x] #2 Its examples are type-checked
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (batch 3): started.

Done. docs/guides/sanity.md (Guides): @sanity/client clients created lazily in src/server/sanity.server.ts (published through the CDN; drafts with a read token, useCdn false, perspective drafts), GROQ queries, a shared Story component, a prerendered /stories list and /stories/[slug] pages with staticPaths that await content in async components through query(); draft previews on a server-mode /preview/stories/[slug] route gated by a signed cookie that /api/preview sets when the studio link's secret matches (noindex, private no-store); static rebuilds from Sanity's webhook straight to the host's build hook, or through a route.ts endpoint that verifies the signature with @sanity/webhook's isValidSignature over the raw body and posts to BUILD_HOOK_URL via platform.waitUntil. Type-checked against @sanity/client 8.9.0 and @sanity/webhook 4.0.4 (pinned devDependencies of @lumiose/cli); checked that a wrong perspective and a missing argument fail. Written against Sanity's documentation; not run against a Sanity project (no account can be created here), as the page's status note says.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Sanity guide: content read in async components and prerendered, draft previews behind a secret on a server route, static rebuilds from the webhook; type-checked against @sanity/client 8 and @sanity/webhook 4.
<!-- SECTION:FINAL_SUMMARY:END -->
