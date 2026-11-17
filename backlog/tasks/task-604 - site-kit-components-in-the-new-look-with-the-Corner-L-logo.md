---
id: TASK-604
title: site-kit components in the new look, with the Corner L logo
status: Done
assignee:
  - '@Halo'
created_date: '2026-11-17T12:28:00Z'
updated_date: '2026-11-17T13:36:00Z'
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
- [x] #1 Logo.stsx draws the Corner L mark with currentColor and the accent token, with the mono uppercase wordmark
- [x] #2 Buttons, cards, callouts, tabs and code blocks match the reference: square corners, hairline borders, no shadows or gradients
- [x] #3 Code highlighting is monochrome: bold keywords, grey comments, amber underline for emphasis
- [x] #4 Active navigation is marked by more than colour (the amber dot plus the text colour)
- [x] #5 Component tests and the a11y checks of site-kit pass in both themes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From TASK-602 (Lux): the Card focus outline still reads the accent token, so it is amber until restyled here; Button, Tabs, SiteNav and Logo still fill with amber.

Halo, session halo-20261117-t604. Every component restyled in packages/site-kit/src; props and exports unchanged, so no consumer needed an edit.
- Control borders (secondary button, theme toggle, GitHub link, menu button) use the grey (borderStrong), not the hairline of the dummy: decision-90 asks 3:1 for control borders. Panels, cards and code blocks keep the hairline.
- Code emphasis is an amber underline on tok-ref (the highlighter's $token references) and on <u> or <mark> from any other highlighter; TokenKind is unchanged. The other tokens share the text colour; keywords are bold, comments grey.
- A CodeBlock title (a file name) keeps its case; only the language label is uppercase.
- Callout kinds share one look and differ by icon and label. Base: inline code is mono with a hairline underneath (no chip), selection is the page inverted, headings are tighter.
- The showcase spec gained identity checks per theme, on dev and production builds: no rounded corners, shadows or gradients anywhere (the nav dot is the one round shape), where amber appears, the inverted primary button, the active link's dot, monochrome code, and the focus ring colour.
- site-kit has no committed axe check (axe-core is not one of its dependencies). An ad hoc axe-core 4.14 run on the showcase (WCAG 2 A/AA, 2.1 AA, 2.2 AA, best practices) in both themes at 1280 and 390 wide, menu open, found no violations.
- For TASK-605/606/614 (apps/web): pages that fill with $color.accent or $gradient.brand, or draw their own logo, favicon or active markers, still need the new look; the amber dot of SiteNav is 2:1 on white, so it stays an addition to the text colour.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
site-kit components follow decision-90: the Corner L logo (text colour plus the accent quarter, mono uppercase wordmark), square hairline panels, inverted primary buttons, monochrome code with an amber underline for emphasis, an amber dot on the active navigation link, and focus rings in the text colour. Props and exports are unchanged. Checks: site-kit lumiose check, unit tests (324), Playwright on dev and production builds (22, with new identity checks in both themes), workspace typecheck and lint, apps/web lumiose check and unit tests (41). Screenshots: backlog/assets/redesign/task-604-site-kit-light.jpg and task-604-site-kit-dark.jpg.
<!-- SECTION:FINAL_SUMMARY:END -->
