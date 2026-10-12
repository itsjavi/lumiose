---
id: TASK-186
title: Replace placeholder lumiose.dev links
status: Done
assignee:
  - Beacon
created_date: '2026-10-10 02:29'
updated_date: '2026-10-12 21:54'
labels:
  - docs
dependencies: []
priority: low
ordinal: 186000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Error messages, the contract and docs point to https://lumiose.dev/errors/… as a placeholder. Waiting for the user: keep if they will own lumiose.dev, otherwise point to the GitHub Pages docs (https://itsjavi.com/lumiose/docs/errors/…).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All lumiose.dev references resolve to a live URL
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: user decided: point every lumiose.dev link to the GitHub Pages docs (https://itsjavi.com/lumiose/docs/…); switch later if a domain is bought. Beacon owns it across the repo (TS and Rust diagnostics, contract, docs) with Lux's permission.

Beacon 2026-10-12: URL scheme of the deployed site (apps/web, pages.yml: base /lumiose/ on itsjavi.com): docs at https://itsjavi.com/lumiose/docs/<topic> (no .md; GitHub Pages 301s to the trailing-slash form, then 200), diagnostics at /docs/errors/LUMxxxx, plus short redirect pages at /errors/LUMxxxx. Checked all 50 packages/lumiose/docs/errors/LUM*.md pages online: all 200. Changed: contract doc-2 (runtime errors point to `lumiose docs LUMxxxx`, online at https://itsjavi.com/lumiose/docs/errors/LUMxxxx; the runtime prints no URL today), registry.rs doc comment, apps/web /errors/[code] comment, lumiose_content fixture post.md(.out) sample link -> https://itsjavi.com/lumiose/docs. Two test-only URL values that were not links (server/serialize.test.ts, vite/src/content.test.ts) now use https://example.com. No hits in evals/, templates, READMEs or packages/lumiose/docs. Checks: cargo test --workspace green; serialize.test.ts and content.test.ts green. Proposal for Lux (not done, message shape and runtime size): packages/lumiose/src/app/diagnostics.ts says the messages use `lumiose docs <code>` until the docs site is online (TASK-122); now that it is, runtime/compiler messages could also print the docs URL.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every lumiose.dev reference now points to the GitHub Pages docs (https://itsjavi.com/lumiose/docs/…), verified live; test-only URL values use example.com. Contract, Rust doc comment, web comment and content fixture updated; cargo test green.
<!-- SECTION:FINAL_SUMMARY:END -->
