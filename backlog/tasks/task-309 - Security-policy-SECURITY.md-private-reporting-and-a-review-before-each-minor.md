---
id: TASK-309
title: 'Security policy: SECURITY.md, private reporting and a review before each minor'
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-15 04:02'
updated_date: '2026-10-15 04:41'
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
- [x] #1 SECURITY.md is committed with the reporting channel, supported versions and expectations
- [x] #2 The user has enabled GitHub private vulnerability reporting
- [x] #3 The release process requires the agent security review before each minor release
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Lux, orchestrator run): SECURITY.md added (private reporting through the Security tab, acknowledgement in 7 days and assessment in 14 as targets, latest 0.x minor supported, scope, provenance and the review process); AGENTS.md Releases now requires the app-security-review pass before each minor. The response targets (7 and 14 days) are a default for the user to confirm. Waiting for the user: enable GitHub private vulnerability reporting in the repository settings (AC #2). Fuzzing (TASK-311/312/313) and the dependency bot (TASK-314) can add a line to SECURITY.md's 'How Lumiose is checked' once they run.

2026-10-15: the user enabled GitHub private vulnerability reporting.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
SECURITY.md (private reporting, response targets, supported versions, scope), private vulnerability reporting enabled by the user, and a security review before each minor release in AGENTS.md.
<!-- SECTION:FINAL_SUMMARY:END -->
