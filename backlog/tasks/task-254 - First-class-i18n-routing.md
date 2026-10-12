---
id: TASK-254
title: First-class i18n routing
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-12 18:40'
updated_date: '2026-10-12 19:31'
labels:
  - router
  - i18n
milestone: m-9
dependencies:
  - TASK-253
priority: medium
ordinal: 256000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-44. Router-level locale prefix (route files stay unprefixed), the request's locale, per-route locale declarations (list or function), locale-aware typed href(), hreflang only for declared locales, <html lang>, opt-in entry detection (Accept-Language/cookie), missing translation as 404 or redirect (site's choice), static prerender per declared locale. The configuration and API names go to the user for approval before implementation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The user approved the config shape and API names (recorded in decision-44)
- [ ] #2 Routing, href(), hreflang, html lang, detection and prerendering work as decision-44 describes, with tests
- [ ] #3 No automatic alternates or duplicate URLs for undeclared locales (tested)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: the user approved the config shape and API names (lumiose({ i18n }), export const locales / function locales, layout-level locales, locale(), ctx.locale, href(.., { locale }), alternates(), "all"); recorded in decision-44. Domains post-1.0.
<!-- SECTION:NOTES:END -->
