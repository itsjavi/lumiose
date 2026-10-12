---
id: TASK-263
title: SPA navigations update hreflang alternates and canonical
status: Done
assignee:
  - Spark
created_date: '2026-10-12 21:46'
updated_date: '2026-10-12 22:24'
labels:
  - i18n
  - spa
  - head
dependencies:
  - TASK-256
priority: low
ordinal: 265000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Split from TASK-261 item 1 (found in TASK-254). The server writes hreflang alternates and the automatic canonical for pages that declare locales, but lumiose/router SPA navigations keep the previous page's links. Update them on navigation (the canonical stays replaceable by a page's own, as on the server). Same client head code as TASK-256, so it follows it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After an SPA navigation, hreflang alternates and the canonical match the new page (none for undeclared locales)
- [x] #2 Tests in happy-dom; runtime size stays under its cap; docs updated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark 2026-10-13: implemented.
- New app/router/locale-links.ts, started by the router next to the <html lang> effect when lumiose({ i18n }) is set. On each committed view it computes the links like the server: for a page declaring 2+ locales, one alternate per declared locale plus the canonical to the current locale, from the view URL in each locale (splitLocale/localizePath/appPath with the trailingSlash define, which is how href() builds them), with location.origin. Error views and single-locale pages get none. It removes the links it manages and appends the new ones; the canonical is skipped when the new page renders its own (<Head>), as on the server.
- Server links are identified at start without any marker (server HTML unchanged): alternates by hreflang among the configured locales, the canonical by its path equal to the first view own (so a page own canonical with another URL, or a site origin, are told apart). A first view whose server render was another page (a rerouted not-found) gets its links written.
- Dependency fixed in dom/head.ts: a hydrated <Head> left the server copy of its elements in <head> forever (it removed its own copy). Now, while hydrating, it takes the equal server element ($$h marks it so two components take one each) and removes it on disposal. Without this, a first page own canonical would stay after navigating away and block Lumiose canonical. Outside hydration the behaviour is unchanged.
- Sizes: core + dom (every export) min+brotli 10182 -> 10194 (+12, the Head change; cap 10240). SPA entry of a real non-i18n app (spa-router-e2e at HEAD, lumiose build): spa chunk 16925 -> 17218 B brotli (+293), since the router imports the module statically. A lazy import() costs +69 eager, but emits a never-loaded chunk in non-i18n builds, which packages/vite/src/app/production/client-runtime.test.ts (exact chunk list, not Spark area) rejects.
- PROPOSAL for Lux (outside Spark paths): have the SPA entry (packages/vite/src/app/router/entry.ts) pass followLocaleLinks in SpaConfig only with i18n, like viewTransition. SPAs without locales would then pay 0 bytes.
Evidence: router.test.ts (server links adopted with a site origin, then /users/2, /search (English only: none), /es/about (page own canonical kept, no Lumiose canonical), /es/users/3; first view without server links), head.test.ts (hydrated <Head> twins taken and removed). spa-router-e2e now has i18n (en, es; the users layout declares both) and a TASK-263 spec (server links on /users/1, client navigation to /users/2 updates them, Home has none): 30/30 Playwright green in dev and build. pnpm check green (1787 tests, size, cargo).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
SPA navigations update the hreflang alternates and the canonical. A new router module (app/router/locale-links.ts) writes them for each committed view as the server does: one alternate per declared locale plus the canonical, from the view URL with location.origin, none for single-locale pages and error views. A page's own <Head> canonical still replaces Lumiose's. It adopts the server's links at start without any HTML marker. A hydrated <Head> now takes over its server elements and removes them on disposal, so a first page's own canonical goes when you navigate away. Runtime: every export +12 B brotli (10194 of 10240); a non-i18n SPA entry +293 B brotli. Proposal: an entry-level opt-in like viewTransition would make that 0. Docs: concepts/i18n, concepts/head. Tests: router and head unit tests, and a spa-router-e2e spec in dev and build.
<!-- SECTION:FINAL_SUMMARY:END -->
