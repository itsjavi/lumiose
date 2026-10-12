---
id: decision-44
title: 'Internationalisation is a routing concern, opt-in per route'
date: '2026-10-12 18:38'
status: accepted
---
## Context

Locale-aware routing and link building are hard in Next.js and React Router: every route moves under a `[locale]` folder, and building localized links is left to the app. The user wants this to be first-class in Lumiose, without automatic behavior that hurts real sites: many sites translate only some pages, and search engines penalize duplicate alternate URLs.

## Decision

Agreed with the user on 2026-10-12. The exact configuration and API names go through the user before implementation.

- **The router handles the locale prefix.** Route files stay unprefixed: `about.stsx` serves `/about`, `/es/about` and `/fr/about`, and the request exposes the locale. No `[locale]` folder, no optional segment.
- **Pages opt in to translations.** A route declares the locales it exists in (a static list, or a function for content-driven pages such as a blog post translated into some languages). Without a declaration, a page exists only in the default locale.
- **No automatic duplicates.** `hreflang` alternates are written only for declared locales, each locale has its own canonical URL, and a missing translation is a 404 or a redirect to the default locale, as the site chooses. A default-locale page is never served under another locale's prefix.
- **Detection is opt-in and only on entry**: redirecting from `Accept-Language` or a cookie happens on `/` or a first visit when enabled, never on every request.
- **`href()` knows the locale**: it keeps the current locale by default and switches with an option; the types come from the declared locales. The document's `<html lang>` follows the request's locale.
- **Translation stays in libraries.** Lumiose does not format messages. The guide shows Paraglide JS (compile-time messages that load only what a page uses) and i18next end to end.

## Consequences

- Prerendered static routes render once per declared locale.
- Independent of decision-42: optional segments remain a general routing feature.
- Tasks: TASK-254 (routing), TASK-255 (guide).
