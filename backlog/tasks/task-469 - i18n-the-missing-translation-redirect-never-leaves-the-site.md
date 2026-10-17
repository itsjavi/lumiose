---
id: TASK-469
title: 'i18n: the missing-translation redirect never leaves the site'
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-16 23:46'
updated_date: '2026-10-17 00:52'
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
- [x] #1 `/es//evil.example/x` and `/es/\evil.example` redirect within the site
- [x] #2 The case is in redirect.property.test.ts
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-17): claimed, branch claude/nova-css-0fc0df.

Nova (2026-10-17): fix in f154d8f6. routeLocale's missing-translation redirect wraps its location in sameSiteLocation() (leading / and \ collapse to one /), and so does the detection redirect (it always adds a locale prefix today, defense in depth). redirect.property.test.ts: explicit /es//evil.example/x, /es/\evil.example, /es/\/evil.example for GET (302) and POST (307), plus a property over paths with empty, backslash and host-like segments; both failed before the fix (Location resolved to https://evil.example). security.md mentions the i18n redirects.

Validation (Nova, 2026-10-17): pnpm check exit 0 (2549 tests); pnpm pack:check --smoke --skip-npm exit 0; Playwright: apps/web 179 passed, ssg-spa-e2e 19, ssg-travel-journal 17, ssr-auth 6, ssr-bookshelf 17, ssr-i18n-i18next 5, ssr-i18n-paraglide 5, ssr-realtime 9, ssr-styles-e2e 10.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The missing-translation redirect (and the detection one) collapse leading slashes and backslashes, so /es//evil.example/x redirects within the site; covered in redirect.property.test.ts; security.md updated. Commit f154d8f6.
<!-- SECTION:FINAL_SUMMARY:END -->
