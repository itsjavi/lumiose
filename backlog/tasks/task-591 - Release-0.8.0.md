---
id: TASK-591
title: Release 0.8.0
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-25 03:02'
updated_date: '2026-10-25 03:43'
labels: []
milestone: m-14
dependencies: []
ordinal: 583000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Release M14 (@lumiose/stsx's first release, the scopedStyles option) and the fixes since 0.7.1 as 0.8.0, a minor. Needs the @lumiose/stsx npm placeholder and its trusted publisher (the user), the delta security review (decision-56), green checks, then pnpm release:version 0.8.0. Ask the user before the release and before the push.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The user published the @lumiose/stsx placeholder and set its trusted publisher
- [x] #2 The delta security review ran and its findings are tasks; those fixed before the release are named in the notes
- [x] #3 pnpm check and pnpm pack:check pass
- [x] #4 The user approved the release and the push in chat; pnpm release:version 0.8.0 ran and the release is published
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux): release prep at the user's request.

**npm placeholder.** @lumiose/stsx is not on npm, and a trusted publisher can only be set on an existing package (.github/CONTRIBUTING.md). The user publishes a 0.0.0 placeholder by hand (prepared outside the repository, LICENSE, README and package.json only), then adds the trusted publisher for release.yml.

**Delta security review** (decision-56), since v0.7.0, the last reviewed minor.
- Inspected: the request handler (head order of shell assets), server rendering (attrs.ts scope classes and tokens, render.ts and island.ts preloads from chunkImports), app/server render and app, the client's applyScope, the Vite build's chunkImports, the scopedStyles option and namespace validation (validated at the napi boundary), and @lumiose/stsx (dev middleware, resolveId, load, transform, hotUpdate, typegen, diagnostics).
- Findings:
  - TASK-588 (Low, security): the stsx dev server serves .stsx files outside server.fs.allow. Reproduced locally: 200 with the code, where Vite gives a .tsx next to it 403. Same root cause as TASK-498.
  - TASK-589 (bug, not security): stsx hot updates write and remove shadows outside the shadow directory for files outside the root.
  - TASK-590 (hardening): the client's applyScope throws on malformed scope tokens, which the server skips.
- No new sink in SSR: scope classes go through escapeAttr, attribute tokens through ATTRIBUTE_NAME, and preload URLs through escapeAttr.
- Not re-reviewed: the body parsing, form actions, Origin check and sanitizers, which have no changes since v0.7.0.

2026-10-25 (Lux): pnpm check green (vitest 2670 passed, 2 skipped; cargo and scripts ok). pnpm pack:check packs 16 packages, @lumiose/stsx included (25 files). node scripts/release.ts 0.8.0 --dry-run: 0.7.1 -> 0.8.0, every lockstep package.json including packages/stsx, the generated loader and llms files, and a CHANGELOG section with the M14 features and fixes. Waiting for the user: the placeholder publish and trusted publisher, whether TASK-588 is fixed before the release, then approval to release and push.

2026-10-25 (Lux): fixed before the release at the user's request: TASK-588, TASK-589 and TASK-590. Affected suites green after the fixes: lumiose 1222, @lumiose/vite 265, @lumiose/stsx 26, the stsx examples 8; typecheck and lint clean (existing warnings only).

2026-10-25 (Lux): the user published @lumiose/stsx@0.0.0 (latest on npm) and set its trusted publisher. pnpm release:version 0.8.0 ran with the scale gate against v0.7.1: production build 0.999x, dev cold start 0.960x, HMR 1.012x, peak RSS 0.990x. Release commit 77df701d (every lockstep package at 0.8.0, @lumiose/stsx included; @lumiose/ui stays 0.2.0) and tag v0.8.0, local. Waiting for the user's approval to push main and v0.8.0.

2026-10-25 (Lux): the user approved the push in chat; main 712e509f and v0.8.0 pushed. Release, Binaries, CI, UI browsers and Pages workflows started. Done once 0.8.0 is on npm.

2026-10-25 (Lux): Release run 40158676543 succeeded: every binary job, publish (22 packages at 0.8.0) and github-release. On npm, latest is 0.8.0 for lumiose and @lumiose/stsx (provenance attested; @lumiose/stsx through its new trusted publisher); the registry took about a minute to show some of them. Pages deployed; CI and UI browsers were still running at closing time.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
0.8.0 released: M14 (@lumiose/stsx's first release, lumiose({ scopedStyles })) and the security review fixes TASK-588 to TASK-590. Scale gate against v0.7.1: build 0.999x, dev cold start 0.960x, HMR 1.012x, peak RSS 0.990x. All 22 packages published from CI with provenance, GitHub release created.
<!-- SECTION:FINAL_SUMMARY:END -->
