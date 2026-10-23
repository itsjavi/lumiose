---
id: TASK-493
title: 'Private app: forms, actions and auth port, with a scorecard'
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-20 21:23'
updated_date: '2026-10-23 20:08'
labels: []
milestone: m-13
dependencies:
  - TASK-492
priority: low
ordinal: 489000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-70, later: port a forms, actions and auth slice of the same private app as the proof for those features. Use Better Auth with email one-time codes instead of the app's own auth system, and port the user onboarding step. Record the scorecard in doc-11 without naming the app or describing its code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Sign-in by email code, onboarding and the ported pages work end to end
- [ ] #2 doc-11 holds the scorecard (stacks and numbers only); gaps become tasks
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User, 2026-10-23: no Postgres server is needed. Use `prisma dev` (Prisma's local Postgres on PGlite) for the database.

Plan (Lux, 2026-10-23), after the list and detail port's 0.6 + @lumiose/ui pass, in the same local port:
1. Sign-in by email code with Better Auth's email OTP plugin. In dev, a logging mailer prints the code (no mail service, no captcha).
2. The onboarding form as a Lumiose form action: profile fields, a live username check, and the first game. It then opens that game's tracker.
3. The tracker page: a server route reads the save and its registrations; an island holds the local draft (marks, undo, chunked save through an action), the view state in the URL and the settings menu (@lumiose/ui).
4. Database: `prisma dev` with only the models the slice needs.
5. Parity and numbers against the original where it can run locally; gaps become tasks. doc-11 gets stacks and numbers only.
<!-- SECTION:NOTES:END -->
