---
id: TASK-598
title: >-
  Website links with trailing slashes, so GitHub Pages serves pages without a
  redirect
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-25 17:57'
updated_date: '2026-10-25 18:02'
labels: []
dependencies: []
ordinal: 590000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub Pages serves each page from its folder's index.html and answers /docs with a 301 to /docs/. The site's internal links had no trailing slash, so every click went through a redirect (found in TASK-597).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 apps/web uses lumiose({ trailingSlash: "always" }), so href() links to pages end in a slash
- [x] #2 Page links built without href() (the playground's diagnostic links) end in a slash; links to files (llms.txt, images, JSON) do not
- [x] #3 A scan of the built site finds no internal link to a page without its trailing slash
- [x] #4 The web app's unit and affected e2e tests pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Solo takeover by Lux (standalone).
- apps/web/vite.config.ts sets lumiose({ trailingSlash: "always" }): href() adds the slash to page links (file routes such as /llms.txt keep none), the dev server redirects to it, and canonical URLs already had it.
- The playground's diagnostic links (docsLink) now go through href(). The Preview Card docs example (packages/ui/docs/preview-card.md), whose live demo on /ui/preview-card links to the site's signals page, uses /docs/concepts/signals/; src/ui-demos and the UI llms-full.txt are regenerated.
- Scan of the built site (every href in HTML, island props, search.json and the llms files, mounted apps excluded): no internal link to a page without its slash.
- Evidence: apps/web vitest (41), lumiose check, the static e2e suites web, ui and redirects (URL and href assertions updated to the slash form), ui docs:check, oxfmt. The a11y suite was not run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The website's internal links end in a slash (trailingSlash: "always"), so GitHub Pages serves every page without a 301.
<!-- SECTION:FINAL_SUMMARY:END -->
