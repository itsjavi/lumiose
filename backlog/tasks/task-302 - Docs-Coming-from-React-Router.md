---
id: TASK-302
title: 'Docs: Coming from React Router'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-15 02:22'
labels:
  - docs
milestone: m-10
dependencies:
  - TASK-301
priority: medium
ordinal: 304000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A guide for React Router 7 framework-mode developers, following the shared outline. Mappings: route modules and routes.ts → file routes (no routes in code, decision-42); loaders and clientLoaders → async components, fetchJSON and query (decision-18); actions and clientActions → form actions, submit() and onSubmit; Form and fetchers → forms, submit(), isSubmitting(), actionData() and optimistic(); revalidation → invalidate(); middleware and context → src/middleware.ts and locals; entry.client, entry.server and root.tsx → document.stsx, middleware and the build's handler; custom servers → dist/server/entry.js and @lumiose/adapter-node; instrumentation; SPA mode and prerendering → rendering modes; useNavigation, useNavigate, useParams and useSearchParams → lumiose/router. What M10 adds is described as missing until it lands, with no promised dates.

Source: the comparison made with the user on 2026-10-15.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The guide covers every mapping above, with type-checked examples
- [ ] #2 Features without an equivalent are listed with the recommended alternative
- [ ] #3 docs:gen, docs:check and the docs tests pass
<!-- AC:END -->
