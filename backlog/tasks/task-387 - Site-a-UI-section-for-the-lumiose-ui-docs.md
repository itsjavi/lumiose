---
id: TASK-387
title: 'Site: a UI section for the @lumiose/ui docs'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-15 17:13'
updated_date: '2026-10-15 18:05'
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
- [ ] #5 Meets WCAG 2.2 AA (doc-9 section 17): axe with the WCAG A and AA tags passes closed and open, with the default theme, in light and dark, and the manual criteria that apply are checked and recorded
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17).

2026-10-15 (user): @lumiose/ui is agent-ready like lumiose (decision-64). The component's docs page lives in packages/ui/docs/<component>.md, follows dialog.md's sections (Anatomy, API, Example, Styling, Keyboard and focus, Without JavaScript, Browser support, Related) and is listed in the UI llms.txt. The site's UI section renders packages/ui/docs (one source with the agent docs, TASK-393).
<!-- SECTION:NOTES:END -->
