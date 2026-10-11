---
id: TASK-236
title: 'Bookshelf: reader-independent shell and per-reader holes on the book page'
status: To Do
assignee:
  - Nova
created_date: '2026-10-11 03:32'
labels:
  - examples
  - ssr
  - rendering
dependencies: []
priority: medium
ordinal: 238000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make `examples/ssr-bookshelf` show, page by page, the patterns that get close to partial prerendering today, with the book page (`/books/[isbn]`) as the explicit "shell + holes" example and the test bed of draft-2 (PPR spike).

User decision (2026-10-11): holes stay no-JS. Each hole is its own `<Suspense>` boundary, but its data stays synchronous (node:sqlite), so it resolves inside the first response and is folded into the shell: no `$swap` scripts, every form keeps working without JavaScript, nothing visibly streams. Do not make the lookups async to force streaming.

Book page split:
- Shell (reads nothing per reader or per request, beyond the route param): `<Title>`/`<Meta>`, cover, genre, title, subtitle, authors, byline, description. `findBook()` and its `notFound()` stay in the shell, so the status is decided before anything streams.
- Per-reader holes: the header account area (in the `(app)` layout, so every server page gets it), the reading-list toggle, and "Your review".
- Fresh holes (same for every reader but change between deploys, or read the request): the rating summary and histogram (derived from reviews), and the reviews list with its pager (`?page=`, and the `own` marker).
Each hole is a component that reads `locals()`/`url()` itself instead of taking a `user` prop from the shell, with a fallback of stable size.

Elsewhere, keep and label the two existing patterns: `/about` and `/genres` (static + the `AccountMenu` client:idle island over `/api/me`), and the home page (server + `<Suspense>` recommendations that really stream).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 On /books/[isbn], nothing outside a <Suspense> boundary reads locals(), url().searchParams or reader-specific queries; the shell is the book's metadata and description
- [ ] #2 The header account area, reading-list toggle, Your review, rating summary/histogram and reviews list are each a <Suspense> hole with a size-stable fallback
- [ ] #3 The book page response contains no streamed chunks (no <template for> or $swap) for signed-in and signed-out readers, asserted in the e2e suite
- [ ] #4 Existing unit and e2e tests pass, including the without-JavaScript suite and the strict CSP checks
- [ ] #5 The About page and README explain the three patterns (static + island, server + streamed Suspense, shell + holes) and which page shows each, linking to the rendering-modes docs
<!-- AC:END -->
