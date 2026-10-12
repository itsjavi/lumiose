---
id: TASK-201
title: Immutable caching for every hashed asset (hashes with '-')
status: Done
assignee:
  - Nova
created_date: '2026-10-10 21:02'
updated_date: '2026-10-12 22:34'
labels: []
dependencies: []
priority: low
ordinal: 203000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found 2026-10-10 when the adapter-node build test failed: Vite/Rolldown base64url hashes contain '-' in about 12% of files (e.g. Counter-D-i-jZkv.js), and adapter-node's conservative isHashed() then serves them with revalidation instead of a one-year immutable cache. Safe but slower. Fix without false positives: e.g. index the build's manifest (or a list the Lumiose build writes) of hashed outputs, or have Lumiose builds use hashCharacters hex/base36. The test now accepts either rule.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every content-hashed build output gets the immutable header; non-hashed files under assets still revalidate; tests cover a dashed hash
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova 2026-10-13: fixed in the shared rule (packages/lumiose/src/app/server/static-files.ts isHashed, used by the fetch handler's static-fs.ts and @lumiose/adapter-node through cacheControl): a name is hashed when it ends in '-' + 8 base64url characters ('-' and '_' included) or [-.] + 8+ word characters, with a digit or an uppercase letter, before the extension. Covers Rolldown's [hash] (8 base64url chars) and Lumiose's merged stylesheets (8 base64url chars); misses only hashes made of lowercase letters, '-' and '_' alone, about 1 in 75,000 files, which revalidate (safe).
- False positives: only hand-written names with such a tail (badge-v2-final.svg). The only files under assets/ the build does not name are public/ copies, so lumiose build now warns about public/<assetsDir>/ files that look hashed (rename or move them).
- Considered: a list of the build's hashed outputs (exact, no heuristic) carried on the server entry's config export to adapter-node and static-fs. PROPOSAL, not done: it adds a field to the documented public config (reference/server-entry.md), which needs the user's approval. Rolldown hashCharacters base36/hex was rejected: all-letter or all-hex-digit tails of hand-written names (-download, -20241231) would match a pattern without the digit/uppercase requirement, and with it 7% of base36 hashes would be missed.
- Observation (pre-existing, documented in adapter-cloudflare/netlify output.ts): the platform adapters' _headers rule makes every file under /assets/* immutable, public/assets copies included.
- Tests: adapter-node isHashed cases (dashed hashes true; icon-download, my-component-v2, photo-2024-01 false), the build-served chunk always immutable, static-fs serves Counter-D-i-jZkv.js immutable and icon-download.svg revalidating, build test for the public/ warning. Docs: reference/adapter-node.md, reference/cli.md.

Nova 2026-10-13, correction and status: the name rule misses a hash whose 8 characters are all lowercase letters, '-' or '_' ((28/64)^8, about 0.13%, 1 file in 750; before: about 12%), so AC #1 ('every') is not fully met by a name rule; those files revalidate, which is safe. Commit 86f6dc6 ships the improved rule, the public/ warning, tests and docs (pnpm check run on it: see the report). NEEDS DECISION (user): the exact fix is a list of the build's hashed outputs on the server entry's documented config export (e.g. an optional config.immutable: string[] of dist/client paths, built from the client bundle's file names, the merged stylesheets and the moved server assets), used by adapter-node and the fetch handler instead of the name rule when present. That adds a public field, so it waits for approval. Back to To Do with needs-decision; claim released.

Lux 2026-10-13 (relayed to Nova): take the exact fix without a public field: the build records the files it hashed (Vite's emitted files, not public/) as internal data of the server entry (not in the documented config); the fetch handler and adapter-node use it; AdapterBuild gets it, and Cloudflare/Netlify write _headers rules for exactly those files instead of /assets/* (check Vercel's routes); drop the build warning if it no longer applies.

Nova 2026-10-13: exact fix done (b078c8a, a32b966). The build records the files it named by content hash: client bundle outputs whose file-name pattern has [hash] (not plugin outputs with an explicit fileName), the merged stylesheets, and the assets moved from the server build; never public/ copies. The list is written into the server entry's config as an internal hashedFiles field (not in BuiltAppConfig, not documented), filled in the server build's generateBundle (placeholder; the build fails if it is missing). cacheControl(file, config) uses it exactly; the conservative name rule (isHashed, reverted to the pre-TASK-201 regex) stays only for configs without the list. AdapterBuild (internal) gets hashedFiles and unhashedAssets (the assets dir's other files). Cloudflare: /assets/* immutable plus '! cache-control' per public/assets file, plus hashed files outside assets/ (stays under its 100-rule cap); Netlify: /assets/* when the dir has no public files, else one rule per hashed file; Vercel: one route regex for the assets dir minus the public files (raw and URI-encoded names), plus hashed files outside it. The public/ build warning is removed. Tests: static-fs list vs fallback, adapter-node serves every built asset immutable and public/assets/badge-v2-final.svg revalidating, build test (list = written files minus public copies, incl. merged CSS and a server-only image; adapter receives the same), adapter rule unit tests. Local e2e (examples/ssr-deploy, new public/assets check): Cloudflare wrangler dev 11/11, Vercel harness 11/11, Node and Bun 11/11. pnpm check green (1793 tests). Docs: adapter-node, cli, deploy cloudflare/netlify/vercel/static, verification table.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every content-hashed build output is cached immutably, exactly: the build lists the files it named by content hash (bundle outputs with [hash] patterns, merged stylesheets, moved server assets; never public/ files) as internal data of the server entry's config and of AdapterBuild. The fetch handler and adapter-node use the list (name rule only as a fallback without it); Cloudflare and Netlify _headers and Vercel's route cache exactly those files, so hand-placed public/assets files now revalidate everywhere. The earlier name-heuristic change and build warning are superseded.
<!-- SECTION:FINAL_SUMMARY:END -->
