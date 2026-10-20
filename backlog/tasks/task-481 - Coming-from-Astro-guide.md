---
id: TASK-481
title: Coming from Astro guide
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-20 21:22'
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
- [ ] #1 packages/lumiose/docs/coming-from/astro.md exists and follows the structure of the other Coming from pages
- [ ] #2 It covers what maps, what improves, and when Astro fits better, without marketing language
- [ ] #3 The docs index, llms.txt and the Related sections of the other Coming from pages link to it
- [ ] #4 pnpm --filter lumiose docs:gen and docs:check pass
<!-- AC:END -->
