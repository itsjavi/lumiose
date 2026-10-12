---
id: TASK-264
title: 'Docker guide: Alpine build stage once the arm64 musl compiler is on npm'
status: To Do
assignee: []
created_date: '2026-10-12 21:59'
labels:
  - docs
  - adapter
dependencies: []
priority: low
ordinal: 266000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-258 adds @lumiose/compiler-linux-arm64-musl, published from the release after 0.2.0. Once it is on npm, packages/lumiose/docs/deploy/docker.md can build on node:24-alpine on both architectures (one base image for build, prod-deps and runtime), keeping the Debian build stage as an option or dropping it. Verify the guide's Dockerfile on arm64 (Apple silicon) with the published package before changing it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After the next release, docker.md's build stage is node:24-alpine (or Debian is documented as an option), verified on arm64 with the published binary
<!-- AC:END -->
