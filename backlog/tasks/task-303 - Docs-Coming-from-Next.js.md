---
id: TASK-303
title: 'Docs: Coming from Next.js'
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
ordinal: 305000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A guide for Next.js App Router developers, following the shared outline. Mappings: route files (already Next-aligned, decision-42; the files Lumiose does not have are LUM5002); server components → components that render on the server by default; "use client" → client:* islands and spa routes; server actions → form actions (no RPC, decision-18); loading.tsx → <Suspense>; error.tsx and not-found.tsx; generateStaticParams → staticPaths; metadata and generateMetadata → <Title>, <Meta> and <Head>; route handlers → route.ts endpoints; middleware.ts; next/link and next/navigation → lumiose/router and href(); fetch caching, revalidatePath and revalidateTag → fetchJSON, query and invalidate(); static, dynamic and ISR rendering → rendering modes; next/image → what exists today (see TASK-279); deployment → adapters.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The guide covers every mapping above, with type-checked examples
- [ ] #2 Next.js features without an equivalent (parallel and intercepting routes, ISR and others found while writing) are listed with the recommended alternative
- [ ] #3 docs:gen, docs:check and the docs tests pass
<!-- AC:END -->
