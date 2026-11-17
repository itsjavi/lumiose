---
id: TASK-613
title: '@lumiose/ui default theme in plain black and white'
status: Done
assignee:
  - '@Halo'
created_date: '2026-11-17T12:29:00Z'
updated_date: '2026-11-17T13:06:00Z'
labels: []
milestone: m-16
dependencies: []
references:
  - backlog/assets/redesign/b-first-light.html
  - backlog/assets/redesign/task-613-ui-theme-light.jpg
  - backlog/assets/redesign/task-613-ui-theme-dark.jpg
ordinal: 605000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the default theme of @lumiose/ui unopinionated (decision-90): black, white and greys through the --lu- custom properties, square or minimal radii, no brand colour except one overridable accent. Projects restyle by overriding the custom properties.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 themes/default.css uses only black, white, greys and one accent custom property, in light and dark
- [x] #2 Every component state (hover, focus, pressed, disabled, invalid) keeps WCAG AA contrast: 4.5:1 for text, 3:1 for controls and focus rings
- [x] #3 packages/ui/docs describe the theme and how to override it, and the changelog notes the visual change
- [x] #4 The ui unit, e2e and a11y suites pass; the local UI showcase renders every component in the new theme
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (halo-20261117-t613). Decisions: (1) no custom property renamed or removed; the 'one accent' is the existing --lu-accent (amber #f5a300 / #ffd27a), which changes meaning from hover surface to decoration; hover surfaces now use --lu-muted. Documented in theming.md. (2) --lu-primary, --lu-ring, --lu-input and --lu-destructive are the text colour; --lu-radius is 0; no shadows; layers get an edge in --lu-popover-foreground. (3) Highlighted menu items, options and the open menubar trigger invert, with the focus ring drawn inside in --lu-primary-foreground. (4) The pressed toggle keeps its bar (grey surface + 3px bar): toggle.e2e.ts asserts the bar as the 'not colour alone' indicator (1.4.1), so the dummy's inverted look was not taken there. (5) The accent is used once, as the square before a navigation menu's current page; the underline carries the state. (6) Invalid: an edge twice as thick; errors: full-strength text, weight 500; no red. The indeterminate progress keeps its hard-stop gradient, which draws the sliding segment.
Contrast (light / dark): text, control edges and rings 21:1; on --lu-muted 18.4 / 17.4; pressed button text on --lu-border 16.2 / 15.1; filled button text hovered 15.1 / 14.8, pressed 8.5 / 10.0; muted text 7.0 / 8.3 on the page, 6.1 / 6.9 on --lu-muted (weakest text pair). Accent on the page 2.07 / 14.75: decoration only.
Checks: ui unit tests 654 passed; pnpm typecheck and pnpm lint clean; ui docs:check clean; examples/ui-e2e in Chromium (dev and build): 1070 passed, 24 skipped, and the 2 toggle failures of the first run pass after restoring the bar (toggle, forced-colors, color-scheme, theme-lows re-run: 41 passed). Not run: Firefox and WebKit projects. Showcase on :5420: all 28 pages render in both schemes; the only chromatic computed colour is the accent square.
Changelog: not hand-edited; the feat(ui) commit subject carries the visual change for the release tooling.
Follow-up outside packages/ui (not done, Beacon's area): apps/web/src/content/content.test.ts 'shows the default theme's palette' hardcodes the old values (--lu-background dark #09090b, --lu-primary #2563eb) and now fails; it needs #000, and #000 / #fff.

Lux (solo takeover of a Beacon file): apps/web/src/content/content.test.ts asserted the old palette values and now expects the black-and-white ones.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The default theme of @lumiose/ui is plain black and white in light and dark: square corners, no shadows, layers edged in their text colour, focus rings in the text colour, and --lu-accent as the one overridable (decorative) colour. All custom property names are unchanged; theming.md documents the look, the accent, the contrast table, what changed and how to restore the previous colours; 18 component pages updated. One follow-up: a palette assertion in apps/web's content test needs the new values.
<!-- SECTION:FINAL_SUMMARY:END -->
