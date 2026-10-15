---
id: TASK-329
title: 'Guide: PostHog'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 04:03'
updated_date: '2026-10-15 06:47'
labels:
  - docs
  - guide
milestone: m-11
dependencies:
  - TASK-295
  - TASK-296
priority: medium
ordinal: 331000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-57: PostHog initialised in instrumentation.client (decision-49), page views on MPA and SPA pages (afterNavigate, decision-50), events and feature flags.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The guide counts page views on MPA and SPA pages and sends an event
- [x] #2 Its examples are type-checked
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (batch 4): started.

Done. docs/guides/posthog.md (Guides): src/instrumentation.client.ts loads posthog-js with a non-awaited import() (it is 305 kB minified / 86 kB brotli, measured; a static import would hold back hydration), inits with capture_pageview false and counts each document load as a $pageview; a PageViews component with afterNavigate in the outermost spa layout counts client navigations (skipping 'enter'); a PlanButton island sends an event; posthog-node in src/server/posthog.server.ts evaluates a flag in a server page; production notes (strict CSP and extensions, reverse proxy for ad blockers, consent) and common mistakes. How it was checked: a scratch Lumiose app with these files, lumiose build and lumiose preview, against a local stand-in for PostHog's API: exactly one $pageview for each MPA load (/ and /pricing), the SPA document load (/app) and each SPA navigation (/app/settings, /app), the plan_selected event with its property, the server page rendering the flag's variant and posthog-node sending $feature_flag_called; same results with the lazy import. Not run against a PostHog project. Type-checked in the docs examples (links for posthog-js and posthog-node); checked that wrong option names fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
PostHog guide: posthog-js started in instrumentation.client, page views on MPA loads and SPA navigations via afterNavigate, an event from an island, flags evaluated on the server; checked against a local PostHog API stand-in.
<!-- SECTION:FINAL_SUMMARY:END -->
