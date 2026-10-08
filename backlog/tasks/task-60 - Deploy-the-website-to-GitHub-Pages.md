---
id: TASK-60
title: Deploy the website to GitHub Pages
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-08 15:58'
labels: []
milestone: m-5
dependencies:
  - TASK-57
  - TASK-58
priority: low
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The website is assembled from separate apps: apps/web provides / and /docs, apps/playground provides /playground. Deployment builds both and assembles them into one static artifact.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A GitHub Actions workflow builds the compiler (napi + wasm), apps/web and apps/playground, assembles dist/ (web at the root, playground under /playground/), and deploys with actions/deploy-pages; base paths and the 404 page work
- [ ] #2 A local script (pnpm site:build) produces the same assembled output; verified by serving it statically; enabling Pages on the repository is left to the user
<!-- AC:END -->
