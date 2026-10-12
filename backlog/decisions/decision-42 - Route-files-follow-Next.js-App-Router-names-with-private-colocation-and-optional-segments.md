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

Approved by the user on 2026-10-12.

- **Special files take the Next.js names:** `layout`, `not-found` and `error` replace `_layout`, `_404` and `_error`.
- **`_` marks private colocation:** files and folders whose name starts with `_` are ignored by the router, at any depth, so components and helpers can live next to their routes.
- **Optional segments:** `[[param]]` (one optional segment) and `[[...rest]]` (optional catch-all), with match ranking, typegen and typed `href()`.
- **`page` is an alias for `index`**, so Next.js-style folders (`blog/page.stsx`) work. Having both in one folder is a duplicate (LUM5003).
- **Kept from Lumiose:** a `.ts` file is an endpoint (Next.js uses `route.ts`), flat files such as `about.stsx` stay valid, and duplicates and invalid names stay errors.

## Consequences

- A breaking change before 1.0: the old special names get a diagnostic with the rename, the docs, templates (`@lumiose/create`), examples and the website move to the new names.
- The route manifest, matcher, typegen, CLI `routes` and the language server change together (TASK-253).
- i18n routing (decision-44) does not need optional segments: the locale prefix is handled by the router.
