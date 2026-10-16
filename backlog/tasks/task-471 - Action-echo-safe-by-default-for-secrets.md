---
id: TASK-471
title: 'Action echo: safe by default for secrets'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-16 23:46'
updated_date: '2026-10-16 23:55'
labels:
  - security
milestone: m-12
dependencies: []
priority: high
ordinal: 469000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's pre-release security review (decision-56, 2026-10-17) on main 1d96433f.

**M3. TASK-430 echo: secrets reach the page unless the action deletes them.** This is a design hazard.
- **Files:**
  - `packages/lumiose/src/server/serialize.ts` (tag F: every text entry);
  - the documented pattern `fail(400, { errors, values: form })` (form.md, data-and-actions.md).
  - Owners: Nova and Beacon.
- **Cause:**
  - The whole FormData's text entries go into the page's `data-l-action` JSON.
  - The docs warn to `form.delete("password")` first: a deny-list.
  - @lumiose/ui's Form refuses to refill password fields, so a developer never sees that the password is still in the HTML.
  - Typical case: a sign-up form with "username taken" (form.md's own example scenario) plus a password field.
- **Impact:** the plaintext password sits in the error page's HTML. It is reachable by every script on the page (analytics, session replay, extensions), by view-source and history, and by any response caching or logging. Each piece is the user's own data, but the default path is unsafe and silent.
- **Fix** (any of):
  - an allow-list helper, `values: pick(form, ["username", "email"])`, used in the docs;
  - drop entries whose names look secret (`/pass|secret|token|otp|code|cvc|card/i`) with a dev warning;
  - make Form send the browser the names it may refill and echo only those.
  - Also fix L1.
- **Confidence:** high (design).
- **Task:** "Action echo: safe by default for secrets (allow-list values)"

Lux (2026-10-17): no new public API is needed. Form's `values` already takes a record, so the docs teach an explicit allow-list (`values: { username: form.get("username") }`) instead of the whole FormData. In dev, the serializer warns when a FormData carries a name that looks secret. A helper such as `pick` would be a new name: propose it in doc-10 rather than adding it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 form.md and data-and-actions.md echo only allow-listed fields, and no example echoes a whole FormData with a password in it
- [ ] #2 In dev, serializing a FormData with a secret-looking name (password, token, secret, otp, card and the like) warns, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-17 (Lux, orchestrator): Beacon's in unattended batch 2. For TASK-470 it may edit packages/lumiose/src/dom (no Spark session is running).
<!-- SECTION:NOTES:END -->
