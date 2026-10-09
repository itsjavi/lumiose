---
id: TASK-175
title: 'Deploy targets: Cloudflare, Vercel and Netlify adapters; deploy docs'
status: To Do
assignee:
  - Nova
created_date: '2026-10-09 12:12'
labels:
  - adapter
  - docs
milestone: m-7
dependencies: []
priority: low
ordinal: 175000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-09: do this last. Packages only where docs are not enough: @lumen/adapter-cloudflare (Workers + static assets, nodejs_compat for AsyncLocalStorage), @lumen/adapter-vercel (Build Output API v3), @lumen/adapter-netlify (Functions with Web Request/Response). Docs-only (with code examples): Bun, Deno, Node hosts (Docker, Fly, Render, Railway), static hosts (GitHub Pages, Cloudflare Pages, S3/CloudFront, Netlify static), AWS Lambda snippet.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Three adapter packages with build output tests; a deploy guide page per target with copy-paste examples
<!-- AC:END -->
