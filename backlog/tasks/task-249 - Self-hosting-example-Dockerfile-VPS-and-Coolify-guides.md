---
id: TASK-249
title: 'Self-hosting: example Dockerfile, VPS and Coolify guides'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-12 18:39'
labels:
  - adapter
  - docs
milestone: m-9
dependencies: []
priority: high
ordinal: 251000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-12: self-hosted VPS and Coolify are first-class targets. An example multi-stage Dockerfile (production deps only, non-root, healthcheck); a VPS guide (Node adapter under systemd or pm2, Caddy or nginx in front, compression, immutable caching of hashed assets); a Coolify guide (deploy from the Dockerfile).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The example Dockerfile builds and serves an example app in a local test
- [ ] #2 VPS and Coolify docs pages with copy-paste config; listed in the deploy verification table
<!-- AC:END -->
