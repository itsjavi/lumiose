---
id: decision-42
title: >-
  Route files follow Next.js App Router names, with private colocation and
  optional segments
date: '2026-10-12 18:38'
status: accepted
---
## Context

Lumiose's route conventions use the `_` prefix for special files (`_layout`, `_404`, `_error`) and reject any other file in `src/routes` (LUM5002), so helpers and components cannot live next to the routes that use them. Optional params (`[[param]]`) are rejected too. Developers coming from React know the Next.js App Router names, where `_` marks private folders instead. The user's own collector, file-router-collector, follows the same Next.js-inspired conventions.

Lumiose keeps its own route implementation (`packages/lumiose/src/app/routes/`): it validates (duplicates, invalid names), ranks matches, reads route module exports, drives typegen and typed `href()`, and is shared by the CLI and the language server. file-router-collector only collects files and leaves matching and duplicates to the framework, so it would replace the directory walk and nothing else.

## Decision

Approved by the user on 2026-10-12, then amended the same day: **Next.js App Router file conventions only, without ambiguity** (one name per role, no Lumiose-specific aliases or flat files).

- **A folder is a URL segment; special files give it behavior**, with the Next.js names:
  - `page.stsx` / `page.tsx`: the page. There is no `index` and no flat page file: `about.stsx` becomes `about/page.stsx`.
  - `route.ts`: an endpoint (`GET`, `POST`, … exports). `sitemap.xml.ts` becomes `sitemap.xml/route.ts`. A `page` and a `route` in one folder are a duplicate (LUM5003).
  - `layout`, `not-found` and `error` replace `_layout`, `_404` and `_error`, with the same nesting semantics as before (nearest wins).
- **Colocation:** any other file in `src/routes` is not a route and is ignored by the router, as in Next.js, so components and helpers live next to their routes. Folders whose name starts with `_` are private: nothing below them routes.
- **Segments:** `[param]`, `[...rest]` (one or more segments, as in Next.js; before, it could be empty), `[[...rest]]` (zero or more) and route groups `(group)`. `[[param]]` (one optional segment) stays as the one extension beyond Next.js, approved in the first version of this decision. Match ranking, typegen and typed `href()` cover them all.
- **Next.js features Lumiose does not have** (`loading`, `template`, `default`, `global-error`, `@slot` parallel routes, `(.)` intercepting routes) are LUM5002 errors rather than silently ignored files, since they look like they would work.
- **Unchanged:** the `src/routes` directory, `src/document.stsx`, `src/middleware.ts`, duplicates and invalid names as errors.

## Consequences

- A breaking change before 1.0, with no backwards compatibility (user, 2026-10-12: nobody else uses Lumiose yet): no rename diagnostic, no upgrading section. The docs, templates (`@lumiose/create`), examples, benchmarks and the website move to the new names.
- The route manifest, matcher, typegen, CLI `routes` and the language server change together (TASK-253).
- i18n routing (decision-44) does not need optional segments: the locale prefix is handled by the router.
