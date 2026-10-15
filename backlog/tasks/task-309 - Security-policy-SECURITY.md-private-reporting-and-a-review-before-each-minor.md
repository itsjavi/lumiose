---
id: TASK-309
title: 'Security policy: SECURITY.md, private reporting and a review before each minor'
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-15 04:02'
labels:
  - security
milestone: m-11
dependencies: []
priority: high
ordinal: 311000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-56: a SECURITY.md at the repository root that asks for reports through GitHub private vulnerability reporting, lists the supported versions (the latest minor until 1.0) and states what reporters can expect. Enabling private vulnerability reporting is a repository setting the user changes. The release process (AGENTS.md, Releases) adds an agent security review (the app-security-review skill) of the request handler, form actions, the Origin check, body parsing, the sanitizers and SSR escaping before each minor release, with findings recorded as tasks. npm provenance and trusted publishing are already in place.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SECURITY.md is committed with the reporting channel, supported versions and expectations
- [ ] #2 The user has enabled GitHub private vulnerability reporting
- [ ] #3 The release process requires the agent security review before each minor release
<!-- AC:END -->
