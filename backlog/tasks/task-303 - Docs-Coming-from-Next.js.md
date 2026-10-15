---
id: TASK-303
title: 'Docs: Coming from Next.js'
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
ordinal: 305000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A guide for Next.js App Router developers, following the shared outline. Mappings: route files (already Next-aligned, decision-42; the files Lumiose does not have are LUM5002); server components → components that render on the server by default; "use client" → client:* islands and spa routes; server actions → form actions (no RPC, decision-18); loading.tsx → <Suspense>; error.tsx and not-found.tsx; generateStaticParams → staticPaths; metadata and generateMetadata → <Title>, <Meta> and <Head>; route handlers → route.ts endpoints; middleware.ts; next/link and next/navigation → lumiose/router and href(); fetch caching, revalidatePath and revalidateTag → fetchJSON, query and invalidate(); static, dynamic and ISR rendering → rendering modes; next/image → what exists today (see TASK-279); deployment → adapters.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The guide covers every mapping above, with type-checked examples
- [x] #2 Next.js features without an equivalent (parallel and intercepting routes, ISR and others found while writing) are listed with the recommended alternative
- [x] #3 docs:gen, docs:check and the docs tests pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (M10 batch 1): started. Guide at packages/lumiose/docs/coming-from/nextjs.md on the shared outline (TASK-301).

Done: coming-from/nextjs.md (Next.js 16 App Router) covers every mapping of the description in five tables (routes and files, components and data, mutations, server and head, navigation, rendering and deployment); LUM5002 files are named. Type-checked examples: an article page (server mode, <Suspense> instead of loading.tsx, a form action instead of a server action, a client:visible island instead of 'use client'), a static page with staticPaths instead of generateStaticParams/generateMetadata, a sitemap.xml endpoint instead of sitemap.ts, middleware instead of middleware.ts/proxy.ts. No-equivalent list: parallel and intercepting routes, ISR and server-side revalidation, PPR, template.tsx, middleware rewrites, folder middleware and instrumentation (missing in this version, no dates; TASK-294 and TASK-298/299 update those rows), image and font optimization (no image component; TASK-279 is still a proposal), generated metadata images, forbidden/unauthorized files, draft mode, custom-server dev (TASK-300), React libraries. No new public names. Validation: docs:gen, docs:check, docs and site content tests green.

From TASK-296 (Spark, 2026-10-15): lumiose/router now has beforeNavigate(fn) and afterNavigate(fn) (decision-50, docs: reference/router.md#navigation-hooks). Map them in this guide: React Router useBlocker/useBeforeUnload -> beforeNavigate (cancel(); willUnload gives the browser prompt); Next.js onRouterTransitionStart and usePathname effects for page views -> afterNavigate (enter on mount); Solid Router useBeforeLeave -> beforeNavigate.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Coming from Next.js guide (docs/coming-from/nextjs.md) on the shared outline, with type-checked examples; listed in the docs index, site navigation and llms.txt.
<!-- SECTION:FINAL_SUMMARY:END -->
