---
id: TASK-214
title: Move the playground into the main website
status: To Do
assignee:
  - Beacon
created_date: '2026-10-10 22:50'
labels:
  - site
milestone: m-7
dependencies: []
priority: high
ordinal: 216000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-11 (decision-37 amendment: lean landing and site IA): apps/playground is a separate app with its own header, so the playground's top menu differs from the site's. Serve it as the /playground route of apps/web with the shared layout, header and footer, and remove the separate app from the site build. The WASM compiler loads only on that page. The editor becomes one island shared with the landing's live demo (TASK-211).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 /playground is a route of apps/web with the site's layout, header and footer; apps/playground no longer ships separately
- [ ] #2 The WASM compiler and preview runtime load only on /playground (and in the landing demo island); other pages' payload is unchanged
- [ ] #3 The playground's existing tests and e2e coverage pass in its new home; pnpm demo, build:site and the README are updated
<!-- AC:END -->
