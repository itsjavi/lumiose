---
id: TASK-60
title: Deploy the website to GitHub Pages
status: In Progress
assignee:
  - Beacon
created_date: '2026-10-08 15:58'
updated_date: '2026-10-09 04:19'
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
- [x] #2 A local script (pnpm site:build) produces the same assembled output; verified by serving it statically; enabling Pages on the repository is left to the user
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-09: reassigned to Beacon. Approved: create .github/workflows/pages.yml and a root script to assemble the site (root config, Lux approves). The repo has no git remote yet, so the workflow cannot run on GitHub; validate by building and serving the assembled artifact locally under a base path. Deployment itself (push/enable Pages) is the user's call.

Beacon 2026-10-09: pnpm build:site [--base /lumen/] [--out dist/site] [--skip-compiler] (scripts/site.ts; named build:site after build:compiler, not site:build) builds @lumen/compiler (napi), apps/web and apps/playground (wasm) with LUMEN_BASE and assembles dist/site (web at the root, playground under playground/). pnpm preview:site serves it below the base like GitHub Pages (directory index.html, trailing-slash redirect, root 404.html). .github/workflows/pages.yml: push to main + workflow_dispatch; actions pinned by SHA (checkout v7.0.1, configure-pages v6.0.0, rust-cache v2.9.2, taiki-e/install-action v2.87.26 for wasm-bindgen 0.2.129, pnpm/action-setup v6.1.0, setup-node v7.1.0 node 24 with pnpm cache, upload-pages-artifact v5.0.0, deploy-pages v5.0.1); rustup toolchain install from rust-toolchain.toml + wasm32-unknown-unknown; base from configure-pages base_path. README Website section. Validation: build at --base /lumen/ and served with preview:site: crawler over 73 HTML pages / 116 URLs from /lumen/, /lumen/docs/, /lumen/playground/ found 0 broken or out-of-base links; browser: landing, docs, docs search (fetches /lumen/search.json), playground (wasm compiles, preview runs), styled 404 for /lumen/docs/missing/page; no console errors. Root-base build (/) also checked. AC #1 stays open: the workflow has never run; the repo has no git remote. Next: user adds the GitHub remote, pushes, and sets Settings > Pages > Source to GitHub Actions; then verify the first run.
<!-- SECTION:NOTES:END -->
