---
id: TASK-609
title: >-
  Docs writing guide and pilot: Getting started and three concept pages, example
  first
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-11-17T12:29:00Z'
updated_date: '2026-11-17T14:26:00Z'
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
- [ ] #1 The guide lives in the docs contributing notes and is linked from AGENTS.md guidance for docs
- [ ] #2 The four pilot pages follow it, and each is at most half its previous word count without losing a fact (facts moved are linked)
- [ ] #3 Getting started is the four steps of the reference, with platform requirements moved to their own page
- [ ] #4 Every example on the pilot pages compiles (the docs tests cover them)
- [ ] #5 The user reviews the pilot before the rewrite tasks start
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
<!-- SECTION:NOTES:END -->
