---
id: TASK-313
title: Property tests for request body parsing and URL sanitization
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-15 04:02'
updated_date: '2026-10-15 05:52'
labels:
  - security
  - testing
milestone: m-11
dependencies: []
priority: medium
ordinal: 315000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-56: property-based tests (fast-check) for URL-encoded, multipart and JSON body parsing under the body and upload limits, the Origin check, redirect target validation and unsafe URL blocking in rendered attributes. pnpm test runs a small number of cases; the nightly fuzz workflow runs many more.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Property tests cover body parsing with limits, the Origin check, redirect validation and unsafe URL blocking
- [x] #2 pnpm test runs them quickly, and the nightly workflow runs them with a high case count
- [x] #3 Failures found are fixed or tracked as tasks
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-15): claimed in worktree branch claude/nova-m10-97578d (M10 batch 3).

Nova (2026-10-15), batch 3, implementation:
- fast-check 4.10.2, pinned devDependency of packages/lumiose (Lux file; deps.lock taken; pnpm-lock.yaml +16 lines).
- Helper packages/lumiose/src/app/server/__fixtures__/property.ts: `LUMIOSE_PROPERTY_RUNS` (default 100 in `pnpm test`), `LUMIOSE_PROPERTY_SEED` to reproduce, a timeout that grows with the case count.
- Nightly switch for Photon (TASK-311): `pnpm --filter lumiose test:properties [runs]` (packages/lumiose/scripts/properties.ts; default 20000 cases per property; runs `vitest run .property.test` with the env set; exit code is vitest's). 20000 cases take about 7 s locally, so the nightly can afford 200000+.
- Properties (24 checks in 4 files): body.property.test.ts (bounded bodies read back unchanged within the limit and are a 413 past it whatever the chunking and content type; URL-encoded, multipart with files and JSON round trips; form parsing fails only with 400/413; Content-Length refusals; parseSize exact and total), csrf.property.test.ts (other hosts refused unless allowed, same host over either scheme accepted, Sec-Fetch-Site trusted, malformed Origin never throws; needsOriginCheck; through the handler a cross-site form post never runs the action, plain or enhanced), redirect.property.test.ts (redirect() lets through only locations a browser resolves to http(s); trailing-slash redirects stay on the site for adversarial paths, through the handler; requestTarget never names another host), server/url.property.test.ts (happy-dom: isUnsafeUrl never misses a URL the WHATWG parser runs as script or loads as data:text/html; server attr() and the client writer agree; attribute values and text survive the HTML parser unchanged; navigationUrl only returns http(s)).
- Found and fixed: `parseSize()` accepted sizes past Number.MAX_SAFE_INTEGER, and a long digit string became Infinity (no limit at all); it now throws a TypeError (docs: reference/vite.md body limits).
- Found, kept on purpose: redirect() strips every control character and space before reading the scheme, so a few odd relative paths ("j avascript:") are refused although browsers read them as paths; stricter, never unsafe (the property states this rule).
- Not ours: fast-check's `stringMatching()` with a `[\\0-…]` class generated code point -1 at larger runs; the tests build those strings with `constantFrom` instead.
- Docs: CONTRIBUTING.md (property tests, the script, reproduce with the seed; root file, Lux area).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Property tests (fast-check) cover bounded body parsing (URL-encoded, multipart, JSON, chunking, limits), the Origin check (unit and through the handler), redirect targets (redirect(), trailing-slash redirects, request targets) and unsafe URLs and escaping in rendered HTML; pnpm test runs 100 cases each, `pnpm --filter lumiose test:properties [runs]` many more for the nightly workflow. One bug found and fixed (parseSize accepted unbounded sizes).
<!-- SECTION:FINAL_SUMMARY:END -->
