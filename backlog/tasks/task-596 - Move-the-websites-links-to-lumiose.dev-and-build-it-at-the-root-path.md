---
id: TASK-596
title: Move the website's links to lumiose.dev and build it at the root path
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-25 17:33'
updated_date: '2026-10-25 17:35'
labels: []
dependencies: []
ordinal: 588000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The website moved from https://itsjavi.com/lumiose/ (GitHub Pages project site under the user's domain) to the custom domain lumiose.dev. Links across READMEs, docs, generated llms files, the docs site and a compiler comment still point to the old URL, and the last Pages deploy was built with base /lumiose/ (from actions/configure-pages), so its asset URLs are wrong on lumiose.dev.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No file outside the backlog links to itsjavi.com/lumiose; links use https://lumiose.dev
- [x] #2 The Pages workflow builds the site at / (no /lumiose/ base), whatever configure-pages reports
- [x] #3 Generated docs (llms.txt, llms-full.txt) are regenerated and their checks pass
- [x] #4 The site build's HTML references assets at /assets/…, and the docs, Rust and site tests touched by the change pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Solo takeover by Lux (standalone).
- Cause: the last Pages deploy ran pnpm build:site --base "/lumiose/" from actions/configure-pages, and the sitemap used the https://<owner>.github.io<base> default. pages.yml now builds with --base / --site-url https://lumiose.dev/ and no longer uses configure-pages.
- Replaced every itsjavi.com/lumiose link outside the backlog (134 links in 47 files: READMEs, docs and their generated llms files, the docs site's URL mapping and its test, a compiler doc comment, a content-crate fixture) with https://lumiose.dev. Comments that named /lumiose/ as this site's base now say it is served at the root; /lumiose/ stays as the e2e test's example base.
- The old URLs already answer 301 to http://lumiose.dev/… (GitHub Pages' redirect); Enforce HTTPS is off in the Pages settings (the user's call).
- Evidence: docs:check for lumiose, @lumiose/ui and @lumiose/stsx; apps/web content tests (25); cargo test -p lumiose_content; actionlint on pages.yml; oxfmt. pnpm build:site --base / --site-url https://lumiose.dev/ built, its HTML references /assets/…, no "/lumiose/ path is left, sitemap.xml lists https://lumiose.dev/ URLs and robots.txt is written.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The site's links point to https://lumiose.dev and the Pages workflow builds it at the root with lumiose.dev sitemap URLs.
<!-- SECTION:FINAL_SUMMARY:END -->
