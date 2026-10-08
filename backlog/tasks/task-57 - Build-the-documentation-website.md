---
id: TASK-57
title: 'Build the website: landing page at / and docs at /docs'
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-08 15:54'
updated_date: '2026-10-08 21:40'
labels: []
milestone: m-5
dependencies:
  - TASK-59
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lumen needs a public website for humans and agents. apps/web is a Lumen SSG site with the marketing landing page at / and the documentation at /docs, rendered from the version-matched markdown in packages/lumen/docs (single source). It is built with Lumen, so it dogfoods the framework, and it uses the shared design system (@lumen/site-kit).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 apps/web (mode static): / landing page presenting the benefits with evidence (.stsx and first-class CSS: placement scopes, $tokens, build-time math via Lightning CSS; performance numbers from TASK-12/20; islands/SPA/SSG; agent-first tooling) and links to /docs and /playground
- [ ] #2 /docs renders packages/lumen/docs markdown with no duplicated content: navigation, per-page TOC, prev/next, code highlighting incl. .stsx, dark mode, responsive; client-side search island over a prebuilt index; error pages at /docs/errors/LUMxxxx with redirects matching the URLs the runtime/compiler print; llms.txt and llms-full.txt at the site root
- [ ] #3 Uses @lumen/site-kit; lumen build outputs a static site that works when served statically; lumen check passes; screenshots in backlog/assets
<!-- AC:END -->
