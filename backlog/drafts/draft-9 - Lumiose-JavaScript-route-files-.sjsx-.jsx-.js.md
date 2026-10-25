---
id: DRAFT-9
title: 'Lumiose: JavaScript route files (.sjsx, .jsx, .js)'
status: Draft
assignee:
  - '@Nova'
created_date: '2026-10-25 04:12'
updated_date: '2026-10-25 04:35'
labels:
  - sjsx
  - routing
milestone: m-15
dependencies:
  - DRAFT-6
  - DRAFT-8
priority: medium
ordinal: 588000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-88: Lumiose accepts JavaScript route files, each name taking the JavaScript counterpart of its TypeScript extensions (`.stsx`→`.sjsx`, `.tsx`→`.jsx`, `.ts`→`.js`).

- **Route classification** (packages/lumiose/src/app/routes/segments.ts, manifest.ts):
  - pages and other route components (page, layout, error, not-found) take `.sjsx` and `.jsx`;
  - endpoints take `route.js`;
  - folder middleware already takes `.js`; root `src/middleware.js` does too.
  - The messages that suggest a file name mention both languages where it helps.
- **Conflicts.** Two files of one kind in a folder, with any mix of extensions, are the existing error.
- **Other conventions:** `instrumentation.server.js`, `instrumentation.client.js` and the other files `src/` conventions name with `.ts`.
- **Dev, production and typegen** (packages/vite/src/app/**): route discovery, the server and client builds, prerendering and SPA tables, and route types. JavaScript route files get their types through JSDoc (`@param {import("lumiose").PageProps<"/x">} props`); the generated route types work there.
- **Generated tsconfig.** It sets `allowJs`; the project decides `checkJs`.
- **Tests.** A JavaScript-only fixture app (pages, layouts, an endpoint, middleware and an island in `.sjsx`/`.jsx`/`.js`) builds, server-renders and hydrates, and a mixed TypeScript and JavaScript app works.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Route files take .sjsx/.jsx (pages and route components) and .js (endpoints, middleware, instrumentation), with the existing conflict errors
- [ ] #2 A JavaScript-only app and a mixed app build, server-render and hydrate; the generated tsconfig sets allowJs and route types work through JSDoc
<!-- AC:END -->
