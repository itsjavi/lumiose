---
id: TASK-261
title: >-
  i18n follow-ups: SPA head alternates, routes listing, Locale typing without
  i18n
status: To Do
assignee: []
created_date: '2026-10-12 20:55'
updated_date: '2026-10-12 21:25'
labels:
  - i18n
  - router
dependencies: []
priority: low
ordinal: 263000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-254 (Nova). (1) SPA navigations do not update hreflang/canonical links (server head only). (2) lumiose routes does not list each route's locales. (3) ctx.locale / locale() are typed Locale but undefined at runtime without lumiose({ i18n }); consider typing them Locale | undefined when LocaleMap is empty, without a new public name. (4) SPA pages with a locales() function load as a document on navigation.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (TASK-255) 2026-10-12: (5) Prefetch vs detection: Chromium's speculation-rules prefetch of "/" (default rules, hover) made with the old locale cookie is a detection redirect, and Chromium reuses it after a language switcher changed the cookie, so switching to the default locale lands back on the old one (seen in examples/ssr-i18n-*; worked around there with <Link prefetch="none"> on the switcher links). Possible fixes, for Nova/Lux: answer requests with Sec-Purpose: prefetch that detection would redirect without the redirect (e.g. 503 + no-store, which Chromium discards), or leave "/" out of the speculation rules when detect.cookie is set. (6) Proposal only, no API decided: there is no way to ask which locales another route declares, so a layout linking an untranslated page hard-codes its locales (examples/ssr-i18n-*/src/routes/layout.stsx, ABOUT_LOCALES).

Nova 2026-10-12: (5) fixed in TASK-254 (6af11f1): speculation rules leave out / with detection on, and detecting requests with Sec-Purpose: prefetch get a 503 no-store the browser discards; the examples' prefetch="none" workaround is removed.
<!-- SECTION:NOTES:END -->
