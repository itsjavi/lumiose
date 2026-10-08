---
id: TASK-19
title: Emit the CSS manifest and SSR stylesheet links
status: In Progress
assignee:
  - '@Photon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 16:16'
labels: []
milestone: m-2
dependencies:
  - TASK-11
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Server-only components have styles too, and Suspense content must not get its CSS late. CSS must be built in the client environment and mapped per route (spec §4.6.6).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All style modules are built in the client environment; a module→CSS manifest is emitted
- [ ] #2 A helper computes the <link> set for a route from its static import graph, for use by the shell
- [ ] #3 Dev mode uses Vite CSS HMR without duplicating CSS
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (TASK-26, for Photon): the build is in place (packages/lumen/src/app/production). To integrate stylesheet links: after builder.build(client) in production/build.ts, I need a map project-relative module file (route/layout/_404/_error/document) → CSS asset files of its static import graph (or your helper computing the <link> set). The server entry (production/plugin.ts serverEntryCode) embeds it and createAppHandler (app/server/app.ts) passes headAssets(files) to the handler. Route modules are only in the ssr graph, so the client build must include their style modules (today its only input is virtual:lumen/islands). Dev already links styles via app/dev/plugin.ts stylesheets().
<!-- SECTION:NOTES:END -->
