---
id: TASK-261
title: >-
  i18n follow-ups: SPA head alternates, routes listing, Locale typing without
  i18n
status: To Do
assignee: []
created_date: '2026-10-12 20:55'
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
