---
id: TASK-302
title: 'Docs: Coming from React Router'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 02:22'
updated_date: '2026-10-15 05:13'
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
- [x] #1 The guide covers every mapping above, with type-checked examples
- [x] #2 Features without an equivalent are listed with the recommended alternative
- [x] #3 docs:gen, docs:check and the docs tests pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (M10 batch 1): started. Guide at packages/lumiose/docs/coming-from/react-router.md on the shared outline (TASK-301).

Done: coming-from/react-router.md covers every mapping of the description in five tables (routes and types, data, mutations, server/document/rendering, navigation). Type-checked examples (docs examples test): the project page (lib/projects.server.ts, routes/projects/[id]/page.stsx, components/AddTask.stsx island importing the action type), middleware with locals, and a custom Node server on @lumiose/adapter-node's createHandler (the examples test now links @lumiose/adapter-node). M10 features are described as missing in this version with no dates: route/folder middleware, instrumentation (handleError -> console.error or the server build's createHandler({ onError })), per-instance fetchers (submission), navigation guards (useBlocker), a dev handler for custom servers. M10 tasks TASK-288..292-style feature work should update the 'What has no equivalent' rows when they land. No new public names. Validation: docs:gen, docs:check, packages/cli/src/docs and apps/web content tests green.

Correction to the note above: the M10 tasks that update this guide's no-equivalent rows are TASK-294 (folder middleware), TASK-296 (navigation hooks), TASK-297 (submission()), TASK-298 and TASK-299 (instrumentation) and TASK-300 (createDevHandler).

From TASK-296 (Spark, 2026-10-15): lumiose/router now has beforeNavigate(fn) and afterNavigate(fn) (decision-50, docs: reference/router.md#navigation-hooks). Map them in this guide: React Router useBlocker/useBeforeUnload -> beforeNavigate (cancel(); willUnload gives the browser prompt); Next.js onRouterTransitionStart and usePathname effects for page views -> afterNavigate (enter on mount); Solid Router useBeforeLeave -> beforeNavigate.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Coming from React Router guide (docs/coming-from/react-router.md) on the shared outline, with type-checked examples; listed in the docs index, site navigation and llms.txt.
<!-- SECTION:FINAL_SUMMARY:END -->
