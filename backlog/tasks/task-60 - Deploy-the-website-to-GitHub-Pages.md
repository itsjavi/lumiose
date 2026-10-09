---
id: TASK-60
title: Deploy the website to GitHub Pages
status: To Do
assignee:
  - Beacon
created_date: '2026-10-08 15:58'
updated_date: '2026-10-09 04:03'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-09: reassigned to Beacon. Approved: create .github/workflows/pages.yml and a root script to assemble the site (root config, Lux approves). The repo has no git remote yet, so the workflow cannot run on GitHub; validate by building and serving the assembled artifact locally under a base path. Deployment itself (push/enable Pages) is the user's call.
<!-- SECTION:NOTES:END -->
