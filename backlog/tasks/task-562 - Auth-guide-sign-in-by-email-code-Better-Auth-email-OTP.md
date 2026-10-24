---
id: TASK-562
title: 'Auth guide: sign-in by email code (Better Auth email OTP)'
status: In Progress
assignee:
  - Beacon
created_date: '2026-10-24 15:38'
labels:
  - docs
  - auth
dependencies: []
priority: medium
ordinal: 554000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lux's request (2026-10-24): guides/auth.md covers email and password only. Add a section on Better Auth's email OTP plugin with Lumiose: plugin config, a sign-in action that requests a code and keeps the sign-in request on the server (a random challenge id in the URL, not the email; the same answer and a padded delay whether or not an account matches), the code action that signs in and sets the session cookie, a dev mailer that prints the code to the server console only, rate limiting, sign-up through the same flow and an onboarding guard in middleware. Also mention prisma dev for a local Postgres. Docs only, no new public API.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 guides/auth.md has a sign-in by email code section covering the plugin config, the challenge-based sign-in action, the code action with Better Auth's Set-Cookie headers, the dev mailer (never render a code on a page), rate limiting, sign-up through the same flow and an onboarding guard in middleware
- [ ] #2 The guide mentions prisma dev for a local Postgres without a server
- [ ] #3 docs:gen output is current; docs:check, the docs tests and typecheck pass
<!-- AC:END -->
