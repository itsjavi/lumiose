---
id: TASK-201
title: Immutable caching for every hashed asset (hashes with '-')
status: In Progress
assignee:
  - Nova
created_date: '2026-10-10 21:02'
updated_date: '2026-10-12 22:18'
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
- [ ] #1 Every content-hashed build output gets the immutable header; non-hashed files under assets still revalidate; tests cover a dashed hash
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
<!-- SECTION:NOTES:END -->
