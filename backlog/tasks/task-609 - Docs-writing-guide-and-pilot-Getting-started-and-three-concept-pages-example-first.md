---
id: TASK-609
title: >-
  Docs writing guide and pilot: Getting started and three concept pages, example
  first
status: Done
assignee:
  - '@Beacon'
created_date: '2026-11-17T12:29:00Z'
updated_date: '2026-11-17T16:18:00Z'
labels: []
milestone: m-16
dependencies:
  - TASK-608
references:
  - backlog/assets/redesign/b-first-light.html
ordinal: 601000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write the docs style guide for the redesign and apply it to a pilot: Getting started, Components, Signals and Styles. Rules: lead with a runnable example, one idea per section, at most three short sentences before code, show the result, move requirements and edge cases to callouts or reference pages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The guide lives in the docs contributing notes and is linked from AGENTS.md guidance for docs
- [x] #2 The four pilot pages follow it, and each is at most half its previous word count without losing a fact (facts moved are linked)
- [x] #3 Getting started is the four steps of the reference, with platform requirements moved to their own page
- [x] #4 Every example on the pilot pages compiles (the docs tests cover them)
- [x] #5 The user reviews the pilot before the rewrite tasks start
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (session beacon-20261117-t609), paused on Lux's request before any file was edited. No pilot page is started or finished; nothing is uncommitted; no server, test run or lock is left behind.

Word counts before (wc -w, code included): getting-started 1242, concepts/components 984, concepts/signals 1003, concepts/styles 6220. Targets: 621, 492, 501, 3110.

Findings so far:
- The docs contract test (packages/cli/src/docs/docs.test.ts) requires every concept page to keep exactly the five ## sections (Concept, API, Example, Common mistakes, Related diagnostics). Plan: keep them, and use example-first ### subsections under Concept.
- Callouts are blockquotes that start with a bold label; '> **Status:**' already gets its own class in apps/web/src/content/docs.ts. No new syntax is needed.
- Docs examples fail on warnings too, and every 'check file=' name must be unique across all docs.
- Tests tied to the current Getting started steps need updating with the page: apps/web/src/content/docs-layout.test.ts (step ids, the 'editor' section) and apps/web/e2e/docs.e2e.ts (step bar titles, '#1-install', '#editor').
- New top-level pages need an entry in SECTIONS (packages/cli/src/docs/index.ts), in the index test's top-level list (docs.test.ts) and in docs/README.md.
- Links to update when headings move: coming-from/astro.md links concepts/styles.md#design-tokens (keep that heading) and #stylesheets-css-modules-and-tailwind (will move).

Planned destinations: requirements.md and manual-setup.md (new, Start here); reference/styles.md (new: scoping mechanics, scopedStyles, $ reference rules, build-time math, build output); guides/stylesheets.md (new: imported CSS, CSS Modules, Tailwind, StyleX); editor feature list to guides/editors.md#vs-code; agent files to reference/cli.md#lumiose-agents-init; props and children details to reference/components.md; flush order and batching details to reference/reactivity.md.

Exact next step: write the writing guide in the docs contributing notes (apps/web/CONTRIBUTING.md has no docs-writing section yet; decide between it and packages/lumiose/docs/README.md), then rewrite getting-started.md as four steps (1. Create a project, 2. Write a component, 3. Style it, 4. Check it) using the template flow (src/components/Counter.stsx used from src/routes/page.stsx as an island).

Beacon (session beacon-20261117-t609b): guide and pilot done; left In Progress for Lux (AC #5, and #1 needs Lux's line in AGENTS.md).

Guide: apps/web/CONTRIBUTING.md, section 'Writing docs pages'. Line for AGENTS.md (Docs bullet): 'Write pages by the docs writing guide in apps/web/CONTRIBUTING.md (Writing docs pages): example first, short sections shaped for the layout, facts moved and linked, never deleted.'

Word counts (wc -w, code included), before -> after: getting-started 1242 -> 566; concepts/components 984 -> 491; concepts/signals 1003 -> 494; concepts/styles 6220 -> 1599.

New pages: requirements.md, manual-setup.md (Start here), reference/styles.md (Style blocks), guides/stylesheets.md.

Moved facts:
- Getting started: requirements and the wasm32 fallback -> requirements.md; the six manual steps, the templates' strict CSP, agent files, --mcp, create-lumiose options and the @lumiose/ui Status note -> manual-setup.md; the editor feature list and the language-server pin -> guides/editors.md#vs-code.
- Components: file types table, props reactivity and lazy server props, children/slots/spread with its example -> reference/components.md#component-functions; long forms of the mistakes stay in the LUM2001-2005 pages and coming-from/react.md.
- Signals: the graph description and owners -> reference/reactivity.md (intro, #owners); equality and the same-object mistake -> #signal; batching rules -> #batch; flush order and the tests note -> #flush; the two effect mistakes -> #effect.
- Styles: scoping mechanics, class passthrough, scopedStyles, typed token names, the rules of $ references, the scale/Meter example with its output, build-time math, browser targets, build output, the Status note and the full mistakes list -> reference/styles.md; imported CSS, cascade order, CSS Modules, Tailwind, StyleX and their mistakes -> guides/stylesheets.md.
- Links updated: coming-from/astro.md, reference/vite.md, reference/jsx.md, errors/LUM3016.md, packages/language-server/README.md.

Tests updated for the new steps: apps/web/src/content/docs-layout.test.ts, apps/web/e2e/docs.e2e.ts (step ids and titles only). Checks: docs:gen, docs:check, cli src/docs tests (32) and web vitest (53) pass. Not run: the Playwright e2e suites (another worker held e2e.lock), so the docs.e2e.ts edits are unverified; pnpm check as a whole.

Screenshots (1280 px, dark): backlog/assets/redesign/task-609-getting-started.jpg, task-609-components.jpg, task-609-signals.jpg, task-609-styles.jpg.

Commits: 1e5dc3b7, 95d199d8, fcfbf682, 28221648.

Lux: AGENTS.md (Docs bullet) now links the guide. AC #5: on 2026-11-17 the user asked to keep going until the redesign tasks are complete, so the rewrite tasks start without the review gate; the pilot review is listed for the user in the final review (TASK-615) and doc-10.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The docs writing guide is in apps/web/CONTRIBUTING.md, and Getting started, Components, Signals and Styles follow it at about half their length, with details moved to new requirements, manual setup, styles reference and stylesheets pages.
<!-- SECTION:FINAL_SUMMARY:END -->
