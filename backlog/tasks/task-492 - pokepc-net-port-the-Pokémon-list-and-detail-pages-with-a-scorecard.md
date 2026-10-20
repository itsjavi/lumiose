---
id: TASK-492
title: 'pokepc-net: port the Pokémon list and detail pages, with a scorecard'
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-20 21:23'
labels: []
milestone: m-13
dependencies:
  - TASK-485
priority: medium
ordinal: 488000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-70: port pokepc-net's /pokemon list (search, filters and sort in the URL, virtualized grid, table mode, JSON route) and /pokemon/[slug] detail from React Router and Tailwind to Lumiose with scoped CSS, on npm lumiose, in its own folder next to pokepc-net (like the itsjavi.com port). Replace nuqs, the radix toggles and tabs and the custom virtual grid with Lumiose code. Record the scorecard in doc-11.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both pages work end to end with the same data and URLs
- [ ] #2 doc-11 holds the scorecard; gaps become tasks
<!-- AC:END -->
