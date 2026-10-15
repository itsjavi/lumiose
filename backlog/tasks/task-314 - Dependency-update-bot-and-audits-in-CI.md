---
id: TASK-314
title: Dependency update bot and audits in CI
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-15 04:02'
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
- [ ] #1 Renovate is configured for weekly grouped npm and Cargo updates and immediate security updates, with exact pins
- [ ] #2 CI runs pnpm audit and cargo audit
- [ ] #3 The user has enabled the Renovate app on the repository
<!-- AC:END -->
