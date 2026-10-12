---
id: TASK-248
title: 'Adapter core: one web-standard fetch handler shared by every adapter'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-12 18:39'
updated_date: '2026-10-12 19:31'
labels:
  - adapter
milestone: m-9
dependencies: []
priority: high
ordinal: 250000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prerequisite for the deploy adapters (TASK-175): expose the built app as fetch(Request) => Response (static assets, streaming, AbortSignal, request context) so Node, Cloudflare, Vercel, Netlify, Bun and Deno adapters are thin wrappers. adapter-node moves onto it without behavior changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A documented fetch-style handler serves a build: pages, endpoints, actions, streaming and static assets
- [ ] #2 @lumiose/adapter-node uses it; the fullstack conformance suite still passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: shape approved in decision-45: the server entry exports default { fetch(request, platform?) }; platform extras as ctx.platform.
<!-- SECTION:NOTES:END -->
