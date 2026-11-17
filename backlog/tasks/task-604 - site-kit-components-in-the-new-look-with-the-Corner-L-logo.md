---
id: TASK-604
title: site-kit components in the new look, with the Corner L logo
status: To Do
assignee:
  - '@Halo'
created_date: '2026-11-17T12:28:00Z'
labels: []
milestone: m-16
dependencies:
  - TASK-602
references:
  - backlog/assets/redesign/b-first-light.html
ordinal: 596000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Restyle every site-kit component to the redesign reference: Logo (Corner L mark and mono wordmark), SiteHeader, SiteNav, Footer, Button, Card, Callout, CodeBlock, CopyButton, Tabs, ThemeToggle, GitHubLink, Base.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Logo.stsx draws the Corner L mark with currentColor and the accent token, with the mono uppercase wordmark
- [ ] #2 Buttons, cards, callouts, tabs and code blocks match the reference: square corners, hairline borders, no shadows or gradients
- [ ] #3 Code highlighting is monochrome: bold keywords, grey comments, amber underline for emphasis
- [ ] #4 Active navigation is marked by more than colour (the amber dot plus the text colour)
- [ ] #5 Component tests and the a11y checks of site-kit pass in both themes
<!-- AC:END -->
