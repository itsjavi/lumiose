---
id: TASK-562
title: 'Auth guide: sign-in by email code (Better Auth email OTP)'
status: Done
assignee:
  - Beacon
created_date: '2026-10-24 15:38'
updated_date: '2026-10-24 15:51'
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
- [x] #1 guides/auth.md has a sign-in by email code section covering the plugin config, the challenge-based sign-in action, the code action with Better Auth's Set-Cookie headers, the dev mailer (never render a code on a page), rate limiting, sign-up through the same flow and an onboarding guard in middleware
- [x] #2 The guide mentions prisma dev for a local Postgres without a server
- [x] #3 docs:gen output is current; docs:check, the docs tests and typecheck pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (2026-10-24, worktree run for Lux). guides/auth.md: a new Sign-in by email code section (Better Auth 1.7 email OTP plugin): the plugin config (hashed codes, 3 attempts, 5 minutes, mail not awaited), a user.additionalFields onboardedAt and a SignInChallenge Prisma model; a dev mailer that prints to the server console only, with the explicit rule never to render a code on a page, response or URL, even in development; the sign-in action (send-verification-otp through authRequest so the rate limiter counts it, a random challenge id in the URL instead of the email, the same answer and a 1 s padded delay either way); the code action (sign-in/email-otp, redirectWithCookies with Better Auth's Set-Cookie headers, error statuses); sign-up through the same flow; an onboarding guard as (app)/middleware.ts (no session -> sign-in, not onboarded -> onboarding) plus the onboarding page; rate limits (plugin 3 per 60 s per client on both endpoints, allowedAttempts, a per-inbox cap idea). Setup now mentions prisma dev for a local Postgres (flags checked against the installed CLI). Production and Common mistakes gained entries for mail delivery, codes on pages, the email in the URL and differing answers. The guide's blocks are not type-checked by the docs tests (no check info string, better-auth is not linked there), so the code was verified in a scratch copy of examples/ssr-auth in the worktree and reverted afterwards (no change to Nova's area): lumiose check passed (onboardedAt typed Date | null | undefined), and a lumiose dev run walked the flow: POST /sign-in 303 to /sign-in/code/<uuid>?next=%2Fitems after ~1.0 s, the code printed in the server console, a wrong code 400, the right code 303 with the session cookie, the guard 303 to /onboarding?next=%2Fitems, onboarding 303 back, the page 200, no session 303 to sign-in, a used challenge 410.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a Sign-in by email code section to guides/auth.md (Better Auth email OTP with Lumiose form actions, a server-side challenge behind a random id, padded same-answer request, dev console mailer, sign-in with Set-Cookie, sign-up through the same flow, onboarding guard in group middleware, rate limits) and a prisma dev note for local Postgres. Verified in a scratch copy of the ssr-auth sample (lumiose check and a dev-server walk-through), reverted. Validation: docs:gen/docs:check, packages/cli/src/docs and apps/web content tests (57 passed), pnpm typecheck green.
<!-- SECTION:FINAL_SUMMARY:END -->
