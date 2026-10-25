---
id: TASK-591
title: Release 0.8.0
status: In Progress
assignee:
  - '@Lux'
created_date: '2026-10-25 03:02'
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
- [ ] #1 The user published the @lumiose/stsx placeholder and set its trusted publisher
- [ ] #2 The delta security review ran and its findings are tasks; those fixed before the release are named in the notes
- [ ] #3 pnpm check and pnpm pack:check pass
- [ ] #4 The user approved the release and the push in chat; pnpm release:version 0.8.0 ran and the release is published
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
<!-- SECTION:NOTES:END -->
