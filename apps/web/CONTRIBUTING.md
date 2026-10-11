# Contributing to the website

The website (`apps/web`) is a static Lumiose app: the landing page, the docs, the showcase, the
benchmarks and the playground. It is built with `@lumiose/site-kit`.

```sh
pnpm --filter @lumiose/web dev        # dev server
pnpm --filter @lumiose/web build      # static build into dist/client
pnpm --filter @lumiose/web test:e2e   # Playwright: behaviour (web, playground, redirects) and accessibility (a11y)
```

The e2e suite builds the site twice (at `/` and below `/lumiose/`) and serves copies of both
builds from `.lumiose/e2e`. Locally, a server already running on port 5194 is reused:

```sh
node e2e/serve.ts 5194 /=.lumiose/e2e/root /lumiose/=.lumiose/e2e/base
```

## Accessibility: WCAG 2.2 AA

Every page meets WCAG 2.2 AA (decision-39). `e2e/a11y.e2e.ts` checks it in the light and the dark
theme on each page type: the landing (its live demo, and the static stand-in that visitors without
JavaScript see), a docs page, the docs and diagnostics indexes, a diagnostic page, the benchmarks,
a benchmark report, the showcase with the demos, the playground and the 404.

- **axe** fails on any violation tagged `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` or `wcag22aa`.
- **Needs review.** Axe cannot compute contrast over a gradient or a pseudo-element, so it reports
  those nodes as "needs review". The suite prints them, grouped by reason. They are then checked
  again with each decorative layer replaced by a solid color at its strongest point (`FLATTENED`
  in the test):
  - the glows at their peak
  - the translucent sticky header over the page's darkest or lightest content
  - both ends of the primary button and gradient text gradients

  A new gradient, glow or translucent layer behind text needs an entry in `FLATTENED`.

- **The landing's light field.** Axe cannot see into the WebGL canvas behind the hero. A test hides
  the copy, captures the stage at 1440, 820 and 390 px over several seconds of light, and compares
  each text color with the brightest pixel behind it (4.5:1, or 3:1 for large text). It prints the
  peak it found; `STAGE_PEAK` in `FLATTENED` must stay at or above it. Other tests check that the
  "Pause animation" button and scrolling the hero away stop the loop, and that reduced motion draws
  one still frame.

- **Motion.** No animation runs longer than 5 seconds, and none runs longer than 1 second under
  `prefers-reduced-motion: reduce`.
- **Focus.** Tabbing through the landing, a docs page, the showcase and the benchmarks, every
  focused element changes how it, or a near ancestor such as a card, looks. No focused element
  below the header is covered by it.
- **Targets.** Every pointer target is at least 24 × 24 px. Smaller targets pass only through
  WCAG's exceptions:
  - links inside a sentence
  - targets whose 24 px circle overlaps no other target

### Manual checklist

Run through this list for every new page, section or visual effect, and for the landing redesign.
The automated checks cover part of it; check the rest by hand in both themes.

- [ ] **Pause motion (2.2.2).** Ambient motion that lasts more than 5 seconds has a visible pause
      control. This covers animated backgrounds, canvases and auto-playing demos. A canvas or a
      `requestAnimationFrame` loop is invisible to the motion test, so check it by hand.
- [ ] **Reduced motion.** Under `prefers-reduced-motion: reduce`, non-essential motion stops:
  - CSS animations and transitions (the base stylesheet shortens them)
  - script-driven animation (check `matchMedia("(prefers-reduced-motion: reduce)")`)
  - view transitions
- [ ] **Focus visible (2.4.7).** Every interactive element shows a focus indicator. The site-kit
      `:focus-visible` ring is the default; never remove the outline without a replacement.
- [ ] **Focus not hidden (2.4.11).** The sticky header, sticky sidebars and popovers never fully
      cover the focused element. Anchored headings keep their `scroll-margin`.
- [ ] **Target size (2.5.8).** Buttons, icon buttons, tabs and controls are at least 24 × 24 px,
      or are spaced so that a 24 px circle around each one overlaps no other target.
- [ ] **Text over moving or image backgrounds.** Text over an animation, canvas, video, image or
      glow sits on a backdrop that keeps 4.5:1 contrast (3:1 for large text) at every frame and
      every point. Use a solid or near-solid panel behind the text, not the effect itself. Never
      let an effect carry information that is not also in the text.
- [ ] **Needs review.** Read the `[axe needs review]` lines that the test prints for the page. A
      reason other than a gradient or a pseudo-element covered by `FLATTENED` (an image, a
      canvas, text in an iframe) needs a manual check or a fix.
- [ ] **Keyboard.** Every control works with the keyboard alone. Scroll boxes such as wide tables
      and code panes can be focused. Editors say how to leave them: CodeMirror keeps Tab for
      indentation, and Escape then Tab moves on.
