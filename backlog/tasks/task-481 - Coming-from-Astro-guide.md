---
id: TASK-481
title: Coming from Astro guide
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-20 21:22'
updated_date: '2026-10-20 21:32'
labels: []
milestone: m-13
dependencies: []
priority: high
ordinal: 477000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A Coming from Astro page next to the React, Next.js, React Router and Solid guides (decision-74). Honest, upbeat framing: what maps one to one (pages, client:* directives, content, file routes, adapters), what gets better (one component model, typed client code through ?client, SPA routes, island details), and a short, matter-of-fact section on when Astro fits better (React, Vue or Svelte islands, its integrations, server:defer, today's island runtime size). The itsjavi.com port is the worked example.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 packages/lumiose/docs/coming-from/astro.md exists and follows the structure of the other Coming from pages
- [x] #2 It covers what maps, what improves, and when Astro fits better, without marketing language
- [x] #3 pnpm --filter lumiose docs:gen and docs:check pass
- [x] #4 The docs index, llms.txt, When not to use and the Astro comparison in Rendering modes link to it (the other Coming from pages don't cross-link, except React's intro)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-20 (Lux): solo takeover from Beacon in the grill follow-up session.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added packages/lumiose/docs/coming-from/astro.md with the shared Coming from outline: mental model (same page model, one component model, typed ?client scripts, where Astro is ahead today, the itsjavi.com port numbers), mapping tables (components, styles and scripts, islands, routing, server, content, config), what has no equivalent, two examples (a header with an island and a typed ?client custom element, type-checked; a blog post from a collection) and common mistakes. Linked from the docs index, When not to use and Rendering modes; llms.txt regenerated; the CLI docs test lists the new guide. The API mapping was verified against the docs by a read-only check. Validation: docs:check, CLI docs and examples tests (26), website preview of the page.
<!-- SECTION:FINAL_SUMMARY:END -->
