---
id: TASK-314
title: Dependency update bot and audits in CI
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-15 04:02'
updated_date: '2026-10-15 04:41'
labels:
  - security
  - ci
milestone: m-11
dependencies: []
priority: medium
ordinal: 316000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-56: Renovate opens one grouped pull request a week for npm and Cargo updates and security updates immediately, keeping exact pins (Rust in [workspace.dependencies]). CI runs pnpm audit and cargo audit. The workflow changes are Photon's area: coordinate. Enabling the Renovate app is a step the user takes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Renovate is configured for weekly grouped npm and Cargo updates and immediate security updates, with exact pins
- [x] #2 CI runs pnpm audit and cargo audit
- [x] #3 The user has enabled the Renovate app on the repository
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Lux, orchestrator run): renovate.json (validated with renovate-config-validator --strict): weekly grouped updates before Monday 6am, exact pins (npm rangeStrategy pin, Cargo bump for the =x.y.z workspace pins), GitHub Action digests pinned, a 3-day minimum release age, OSV and GitHub vulnerability alerts at any time with the security label. CI gains an audit job: `pnpm audit:packages` (scripts/audit.ts, tested in scripts/audit.test.ts) audits the production dependencies of the published packages only, failing on high or critical, since pnpm audit cannot filter the workspace; and `cargo audit`. Today the published packages have no advisories; the examples and benchmarks have 11 (mysql2, simple-git, node-forge, braces, deepmerge-ts, uuid, esbuild) that Renovate will update once enabled. cargo audit found RUSTSEC-2026-0235 (rkyv 0.7 through parcel_sourcemap 2.1.1, the latest, required by Lightning CSS); Lumiose never reads rkyv archives, so .cargo/audit.toml ignores it with that reason. Waiting for the user: enable the Renovate GitHub app on the repository (AC #3). The CI workflow is Photon's area: changed by the orchestrator while Photon was idle.

2026-10-15: the user enabled the Renovate app. Until renovate.json reaches the remote with the end-of-run push, Renovate may open its onboarding PR; it closes once the config is on main. The new CI audit job first runs on that push; locally scripts/audit.test.ts, the audit script, cargo audit and the config validator pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Renovate (weekly grouped updates, security updates at once, exact pins, 3-day release age) enabled by the user, and a CI audit job: pnpm audit of the published packages and cargo audit, with RUSTSEC-2026-0235 ignored for a documented reason.
<!-- SECTION:FINAL_SUMMARY:END -->
