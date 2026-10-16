---
id: TASK-469
title: 'i18n: the missing-translation redirect never leaves the site'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-16 23:46'
labels:
  - security
milestone: m-12
dependencies: []
priority: high
ordinal: 467000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's pre-release security review (decision-56, 2026-10-17) on main 1d96433f.

**M1. i18n: the missing-translation redirect is an open redirect.**
- **File:** `packages/lumiose/src/app/server/handler.ts`, `routeLocale`: `new Redirect(base + path.slice(1) + search, …)` (around 736–741). Owner: Nova.
- **Prerequisites:**
  - `i18n` with `missing: "redirect"`;
  - a page route that matches a path starting with `//`, such as a root catch-all `[...rest]`;
  - a locale the route doesn't declare (a `locales` list or `locales()` subset).
- **Repro** (real handler; locales `en`/`es`; root `[...rest]` page with `locales = ["en"]`):
  - `GET /es//evil.example/x` → `302 Location: //evil.example/x`;
  - `/es/\evil.example` → `//evil.example` (the URL parser turns `\` into `/`);
  - POST gets a 307. The Origin check limits that to same-origin forms.
- **Impact:** phishing links on the app's own domain.
- **Fix:** collapse leading slashes and backslashes, as `trailingSlashRedirect` and `sameSiteLocation()` already do. Add the case to `redirect.property.test.ts` (it covers `redirect()` and the trailing-slash redirect, not this one).
- **Confidence:** confirmed.
- **Task:** "i18n: the missing-translation redirect never leaves the site"
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `/es//evil.example/x` and `/es/\evil.example` redirect within the site
- [ ] #2 The case is in redirect.property.test.ts
<!-- AC:END -->
