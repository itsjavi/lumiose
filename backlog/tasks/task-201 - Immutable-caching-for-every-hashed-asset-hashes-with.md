---
id: TASK-201
title: Immutable caching for every hashed asset (hashes with '-')
status: To Do
assignee:
  - Nova
created_date: '2026-10-10 21:02'
labels:
  - adapter
  - perf
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
