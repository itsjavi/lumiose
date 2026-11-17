---
id: TASK-617
title: Dev tools (the inspector) in the new look, with the Corner L icon
status: Done
assignee:
  - '@Nova'
created_date: '2026-11-17T17:17:00Z'
updated_date: '2026-11-17T17:23:00Z'
labels: []
milestone: m-16
dependencies: []
references:
  - backlog/assets/redesign/b-first-light.html
  - backlog/assets/redesign/logos.html
ordinal: 609000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Lumiose dev tools that the dev server injects into pages (the inspector and its launcher button) still use the old identity: the gradient orb icon, violet and amber colours, rounded panels and shadows. Restyle them to decision-90 and replace the old icon with the Corner L mark (user, 2026-11-17).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The launcher shows the Corner L mark; the old gradient orb is gone from the dev tools and from every other place in the repository that still ships it
- [x] #2 The dev tools panel uses the new identity in light and dark: black, white, one grey, hairline borders, square corners, mono uppercase labels, no gradients or shadows; amber only as the accent
- [x] #3 Text keeps 4.5:1 and control borders and focus rings 3:1 in both themes; the tools stay readable over any page because they carry their own colours
- [x] #4 Behaviour, shortcuts and the public options of the dev tools are unchanged; their tests pass
- [x] #5 The dev tools docs (concepts/dev-tools and the reference) and any screenshots of them are updated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (nova-20261117-t617), commit 1c30782b.
- Launcher: 32px square, text-colour border, Corner L built as SVG elements (classes coloured by the constructed stylesheet, so it still works under the strict CSP). Position, accessible name, title, shortcut and `inspector: false` unchanged. The 0.7 idle opacity went away so the border keeps its contrast on any page.
- Panel: opaque, text-colour top edge, mono uppercase tabs, headings, table heads and badges; square buttons with grey borders; amber only under the selected tab and beside the selected tree row (both also bold or underlined). The page highlight is a two-tone outline (text colour plus background colour) with an amber tint.
- Theme mechanism unchanged: prefers-color-scheme.
- Status colours: only the red of a failed island and its error stays (the word 'failed' and the Error column carry the meaning). The green of hydrated and the amber of pending states became plain text and grey.
- errors.ts has no look of its own (it feeds Vite's error overlay), so nothing to restyle. No other injected dev UI.
- Old icon: a repository search (gradient colours, gradients in SVG, data-URI icons, favicons, icon files) found it only in the inspector. READMEs, the site favicon, the create templates and the VS Code icon are TASK-615's and already show the Corner L in the working tree.
- Contrast (computed from the stylesheet's colours): text 21:1 both themes; grey text and control borders 7.0:1 light, 8.3:1 dark (6.3 and 7.1 on the hover surface); error red 6.6:1 light, 9.2:1 dark; focus rings 21:1.
- Verified in examples/ssr-bookshelf dev on port 5198: both colour schemes, each over a light and a dark page; Tree, Signals, Islands, Select.
- Checks: packages/vite tests 265 passed, docs tests 72 passed, typecheck, lint, docs:check green.
- Not verified: the Why panel with data, a failed island's red in a real page, forced-colors mode.
- Screenshots: backlog/assets/redesign/task-617-devtools-light.jpg, backlog/assets/redesign/task-617-devtools-dark.jpg
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The dev inspector and its launcher use the decision-90 identity in both colour schemes, with the Corner L logo in place of the gradient orb; behaviour and options are unchanged, and the docs describe the new launcher.
<!-- SECTION:FINAL_SUMMARY:END -->
