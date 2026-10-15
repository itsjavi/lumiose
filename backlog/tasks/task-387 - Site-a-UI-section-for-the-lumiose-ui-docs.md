---
id: TASK-387
title: 'Site: a UI section for the @lumiose/ui docs'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-15 17:13'
labels:
  - ui
  - docs
  - site
milestone: m-12
dependencies:
  - TASK-353
  - TASK-355
priority: high
ordinal: 388000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User request, 2026-10-15: the Lumiose site gets its own UI section (for example /ui) that is the @lumiose/ui documentation, in the way base-ui.com and ui.shadcn.com document theirs. It needs:
- an overview: unstyled primitives, the optional default theme, installation;
- a page per component: live demo styled with @lumiose/ui/themes/default.css, parts and props, events, CSS variables, keyboard contract, accessibility notes;
- a theming page for the --lu- custom properties, with light and dark.
It is the default UI docs and getting-started reference, and grows with each component task (TASK-355 onward). The packaged Markdown docs (packages/lumiose/docs, llms.txt) stay the source for agents: generate or link one from the other rather than writing both by hand. Contract: decision-62.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The site has a UI section with an overview, installation and theming page
- [ ] #2 Every shipped component has a page with a live demo on the default theme, parts, props, events, CSS variables and its keyboard contract
- [ ] #3 The packaged docs and the site pages come from one source
- [ ] #4 The section passes the site's axe checks in light and dark
<!-- AC:END -->
