---
id: TASK-273
title: A README on npm for every published package
status: Done
assignee:
  - Lux
created_date: '2026-10-14 00:05'
updated_date: '2026-10-14 00:08'
labels: []
dependencies: []
ordinal: 275000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Before 0.4.0: 12 of the 13 published packages ship no README.md (npm shows 'No README data found' for lumiose@0.3.0). Add a minimal README per package (what it is, install, smallest usage, docs link, license), the lumiose one as the npm landing, and make pack:check fail on a public package without README.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every non-private package in packages/ has a README.md matching its docs
- [x] #2 pnpm pack:check reports a public package without README.md; scripts tests cover it
- [x] #3 Root README links use the site's canonical trailing-slash URLs
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: README.md for lumiose (npm landing: header, quick start, sample, features, packages, docs), @lumiose/vite, cli, compiler, create-lumiose, the four adapters, eslint-plugin, prettier-plugin and language-server, each from its docs page (install, smallest usage, docs link, license); the compiler's platform packages already had theirs. scripts/pack.ts reports 'no README.md' (pack.test.ts covers it). Root README and the generated note use the site's trailing-slash URLs. Checks: every itsjavi.com link in the READMEs returns 200; pnpm pack:check passes for 14 tarballs, each with package/README.md; node --test scripts/pack.test.ts 11/11; content tests; oxfmt.
<!-- SECTION:NOTES:END -->
