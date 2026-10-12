---
id: TASK-198
title: lumiose as a peer dependency of @lumiose/vite
status: Done
assignee:
  - Photon
created_date: '2026-10-10 19:27'
updated_date: '2026-10-12 22:04'
labels:
  - package
dependencies: []
priority: low
ordinal: 200000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-193: @lumiose/vite's Vitest setup resets scoped state on the lumiose copy it resolves. If an app ever resolves two lumiose copies, the reset would clear the wrong one (and compiler-emitted imports would bind elsewhere). Make lumiose a peer dependency of @lumiose/vite (workspace:^ peer + workspace:* dev), as @lumiose/query does; check pack:check and the create templates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumiose is a peer of @lumiose/vite; pack:check and release tests pass; create templates still install
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon 2026-10-13: lumiose moved from dependencies to peerDependencies (workspace:^, packed as ^0.2.0) plus devDependencies (workspace:*) of @lumiose/vite, as @lumiose/query does; lockfile updated under deps.lock (the vite importer's lumiose link moves to devDependencies). @lumiose/cli keeps lumiose as a dependency, which satisfies the peer when the CLI pulls the plugin; the create templates list lumiose in dependencies. reference/vite.md says both lumiose and vite are peers (llms-full regenerated).
Evidence: `node scripts/pack.ts --smoke` passes (14 packages; packed @lumiose/vite has peer lumiose ^0.2.0 and no lumiose dependency; npm publish --dry-run accepts the new ones; create-lumiose --template ssr + lumiose check + build pass). All four templates (minimal, spa, ssr, static) scaffolded with the packed create-lumiose, installed from the tarballs with npm, then lumiose check and build pass, each with exactly one lumiose copy in node_modules; the ssr template with pnpm 11 too (one lumiose, one @lumiose/vite, no peer warnings). Release tests (node --test scripts/*.test.ts) 31/31; @lumiose/vite typecheck clean; full Vitest run: 1782 passed, 1 failure in TASK-260's in-progress build.test.ts (Nova, unrelated).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumiose is a peer dependency of @lumiose/vite (workspace:^ peer, workspace:* dev), as for @lumiose/query, so the plugin and its Vitest setup use the app's lumiose copy. pack:check --smoke and the release tests pass; every create template installs (npm, and pnpm for ssr), checks and builds from the packed tarballs with a single lumiose copy. reference/vite.md documents the peers.
<!-- SECTION:FINAL_SUMMARY:END -->
