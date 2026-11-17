---
id: TASK-602
title: 'site-kit tokens: black, white, one grey and one amber accent in both themes'
status: Done
assignee:
  - '@Halo'
created_date: '2026-11-17T12:28:00Z'
updated_date: '2026-11-17T12:56:00Z'
labels: []
milestone: m-16
dependencies: []
references:
  - backlog/assets/redesign/b-first-light.html
ordinal: 594000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the site-kit colour, radius and type tokens with the palette and type of the redesign reference (decision-90): black and white, one mid grey, hairline and soft-surface greys, one warm amber accent, square corners, mono uppercase labels.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tokens match the reference in both themes: dark (#000, #fff, grey #a3a3a3, accent #ffd27a) and light (#fff, #000, grey #595959, accent #f5a300)
- [x] #2 A test computes contrast for every text token on every surface token: at least 4.5:1, and 7:1 for the grey on the page background
- [x] #3 Amber is never a text colour or a focus ring; focus rings use the text colour
- [x] #4 Old brand colours (violet, gradients) and rounded radii are gone from the tokens
- [x] #5 Every site-kit consumer still builds and type-checks
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Map the reference palette onto the existing token names (no renames). 2. Square radii, no shadows, flat gradient tokens, new fonts, focus ring in the text colour. 3. Contrast test over every text/surface pair. 4. Validate site-kit and apps/web.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (session halo-20261117-t602). Values only: every exported token name and the module shape are unchanged, plus one new group, `label` (mono, 11px, 0.14em, uppercase).

Mapping onto the existing names, per theme (light / dark):
- bg, surface: #fff / #000. sunken, accentSoft, codeBg, info/warn/tip Bg: the soft surface #f6f6f6 / #0d0d0d.
- text, accentText, glowText, codeFg, inlineCodeFg, info/warn/tip Fg: #000 / #fff. muted, subtle, borderStrong: the grey #595959 / #a3a3a3.
- border, inlineCodeBorder, info/warn/tip Border: the hairline #e2e2e2 / #262626.
- accent, accentHover, glowA, glowB: amber #f5a300 / #ffd27a. accentFg (text on an amber fill): #000 in both.
- Syntax colours are monochrome: comments and punctuation in the grey, the rest in the text colour.
- radius: every step 0px. shadow: every step a zero-size transparent shadow (`none` is invalid inside a box-shadow list, which Button and Card build). gradient: flat colours (brand = accent, text = text, glow = transparent); all readers use them as a `background` value.
- font: the reference stacks (Helvetica Neue sans, ui-monospace mono). focus: 2px solid in the text colour, offset 3px.

The palettes stay literal objects: the compiler inlines only literals, so a helper that builds them fails with LUM3008.

Test: packages/site-kit/src/tokens.test.ts computes WCAG contrast for 18 text tokens on 8 surface tokens in both themes (4.5:1), the grey on bg (7:1), accentFg on amber, borderStrong on surfaces (3:1); asserts amber is no text token, the focus ring is the text colour, the palette holds only the six values, radii are 0 and no gradient or shadow remains.

Left for TASK-604 (components were not touched, they compile): Card's own focus outline reads $color.accent, so it is amber until restyled; primary Button, Tabs and SiteNav markers and the Logo orb still fill with amber; Base.stsx keeps an amber ::selection and Inter font-feature-settings. Once nothing reads them, the leftover names (gradient, glowA/glowB/glowText, accentHover, accentSoft, shadow, radius steps) can go.

Outside this area (Beacon, apps/web), not edited: scripts/og-images.ts, public/favicon.svg and src/playground/samples.ts hard-code old brand colours (TASK-605/606 cover them).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
site-kit tokens now carry the decision-90 identity in both themes: black and white, one grey, a hairline and a soft surface, one amber accent, square corners, no shadows, no gradients, focus ring in the text colour. Names are unchanged, so apps/web builds without edits.

Checks: site-kit unit tests 324 passed (tokens.test.ts is new); site-kit lumiose check (kit and showcase) clean; showcase Playwright 14 passed, 8 screenshot specs skipped; pnpm typecheck and pnpm lint pass; apps/web: lumiose check clean, lumiose build prerendered 281 files, unit tests 41 passed.

Not verified: apps/web Playwright (e2e, axe contrast over the light field) was not run; its pages still have their old layout and hard-coded colours until TASK-605 to TASK-607. The apps/web build was run as `lumiose build` without the playground wasm asset step, which fails locally on a wasm-bindgen CLI version mismatch unrelated to this change.
<!-- SECTION:FINAL_SUMMARY:END -->
