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

The apps the site mounts below it (the showcase apps at `/showcase/<slug>/`, the demos at
`/demos/<slug>/` and the benchmark UIs, listed in the repository's `scripts/site-mounts.ts`) are
separate builds. The dev server serves them from this app's `dist/site` (after `pnpm build:site`, for the same
base) or from each package's own build (`apps/web/scripts/dev-mounts.ts`); an app with no usable build gets a dev page
naming the command that builds it. The `dev` Playwright project (`*.dev.e2e.ts`) runs against
`lumiose dev` on port 5196.

## Writing docs pages

The guide for every page in `packages/lumiose/docs` (and the docs of `@lumiose/ui` and
`@lumiose/stsx`), for agents and humans (decision-90, TASK-609). The pilot pages show it applied:
`getting-started.md`, `concepts/components.md`, `concepts/signals.md` and `concepts/styles.md`.

**The rules.**

1. **Lead with a runnable example.** Each page and each section opens on code a reader can paste
   and run: a whole component or file, not a fragment.
2. **One idea per section.** A second idea gets its own `###` heading and its own example.
3. **At most three short sentences before the code.** Say what the code shows, in plain, direct
   sentences. No history, no internals.
4. **Show the result** after the code where it helps: the text on screen or the command's output
   in a `text` block, or the CSS that ships.
5. **Requirements, platform notes, status notes and edge cases are callouts or reference pages.**
   A callout is a blockquote that starts with a bold label (`> **Status:** …`,
   `> **Details:** …`) and holds one or two sentences with a link to where the rest lives.
6. **No fact is deleted.** A fact that leaves a page moves to a reference page, a guide or a
   diagnostic page, and the page it left links to it. Check that the destination really has it.
7. **A page reads in a few minutes.** A concept page that grows past about 600 words (code
   included) is two pages, or has reference material to move.

**Shape sections for the layout.** The site lays a page out from plain Markdown
(`layoutRows` in `src/content/docs.ts`). There is no layout syntax, and none may be invented. A
section is a `##` or `###` heading up to the next one. On desktop:

| You write                             | You get                                                 |
| ------------------------------------- | ------------------------------------------------------- |
| Heading, words, then code             | Words on the left, the code on the right.               |
| Heading, code, then words             | The heading and the words on the left, beside the code. |
| Heading, words, code, then more words | A pair, then the later words as a full-width row.       |
| Several code blocks in a row          | All of them on the right, stacked.                      |
| Words without code, or a table        | One column. Tables are always full width.               |

So put all the words of a section either before its code or after it, not both. Keep the words
beside a block shorter than the block. Keep code lines under about 60 characters, since the code
column is narrow. Code nested in a list item is not paired: use top-level blocks.

**Step pages.** A page whose `##` headings are `## 1. Title`, `## 2. Title`, … (at least two,
counting from 1 in order) gets the sticky step bar. Keep step titles to two or three words, and
put unnumbered sections (Editor, Next) after the steps.

**What the generators and tests require.**

- **Concept pages** keep exactly these `##` sections, in order: Concept, API, Example, Common
  mistakes, Related diagnostics. Put the example-first sections under Concept as `###`. Coming
  from guides keep their own outline (`packages/cli/src/docs/docs.test.ts`).
- **Every page** starts with `# Title`, then a one-line `> summary`.
- **Examples are checked.** A `tsx`, `stsx` or `ts` block with `check` in its info string is
  type-checked and must compile without warnings. `file=path` places it below `src/` so examples
  can import each other; every `file=` name is unique across all docs, and it shows as the block's
  title. Do not invent API: check the source when unsure.
- **Links** are relative `.md` links that resolve. When a heading changes, search the repository
  for its anchor.
- **A new page** gets an entry in `packages/lumiose/docs/README.md` (the index gives the
  navigation and its order). A new top-level page is also added to `SECTIONS` in
  `packages/cli/src/docs/index.ts` and to the index test's list.
- **Reference pages:** a `##` or `###` heading that is an export's name is what
  `lumiose docs <name>` prints, so keep those headings to the bare names.
  Every entry (function, component, option group, command) has, in this order: a one-line summary
  and its details, the signature as the source has it, one short example (`check`ed when it can
  compile on its own), and a table of its options, parameters or props with the columns Name,
  Type, Default, Description (`—` for no default).
- **Diagnostic pages** (`errors/LUMxxxx.md`): the header above the end marker is generated from
  the compiler's registry (`pnpm --filter lumiose docs:gen`), and the body below it is written by
  hand. The body has, in this order: a `>` summary and a **Reported by** line, `## What it means`
  (one short paragraph), `## Example` (code that reports the diagnostic), `## How to fix it`
  (words, then the corrected example), `## Details` when there are rules and edge cases to keep,
  and `## Related` (links to the concept page). Keep codes, titles and section names: the CLI,
  the language server and tests read them.
- **After editing:** `pnpm --filter lumiose docs:gen`, then `pnpm --filter lumiose docs:check`,
  `pnpm --filter @lumiose/cli exec vitest run src/docs` and
  `pnpm --filter @lumiose/web exec vitest run`. Look at the page at 1280 px.

## The UI section (`/ui`)

`/ui` is `@lumiose/ui`'s documentation (TASK-387). Its pages are the Markdown that the package
ships, `packages/ui/docs`, in the order of `packages/ui/docs/llms.txt`. Nothing is written twice:

- **Pages.** `src/content/docs.ts` renders them, and `src/routes/ui/[[...path]]/page.stsx` serves
  them at `/ui/<page>` (the README at `/ui`). The docs navigation lists them in its UI section,
  and the old `/docs/ui/*` URLs are static redirects.
- **Gallery.** `/ui` opens on a grid of every component, live (TASK-614): one cell per page of
  the `llms.txt` Components section, running that page's first live demo, with a footer that
  links to the page. The README follows the grid. `src/content/ui-gallery.ts` builds the cells
  and fails the build when a component page has no live demo.
- **Component pages.** A page of the Components section shows its first demo as a large preview,
  then its usage beside its props, then the page as written. `ui-gallery.ts` reads the three
  from the template every component page follows: usage is the import block before the first
  section plus the Anatomy snippet, and the props are the first table of the API section. The
  guides (Installation, Theming, Virtualizer) render as docs pages.
- **Live demos.** Every ` ```tsx check ` example (the ones the docs tests type-check) that
  exports one component without props is also a live demo. It is shown above its code, except
  the page's first one, which runs at the top instead: a component rendered twice would repeat its
  ids. `scripts/ui-demos.ts` writes the examples to
  `src/ui-demos/` (generated, committed), with `UiDemo`, which renders them by id. An example
  is server-rendered, so it works without JavaScript as far as its component does. It is an
  island (`client:visible`) when it uses signals, `bind:`, `on:` or an event prop.
- **Theme.** The `/ui` page imports `@lumiose/ui/styles.css` and `themes/default.css`, so only the
  `/ui` pages load them. The site's theme toggle sets the `color-scheme` that the theme's
  `light-dark()` colours follow. Inside a demo, `all: revert-layer` drops the site's own base
  styles, so the components look as the default theme draws them. The palette on the page with
  the `--lu-` property table (Theming) is read from the theme's stylesheet.

**Adding a component** (such as Combobox, once its page lands in `packages/ui/docs`):

1. Its page follows `dialog.md`'s sections and is listed in the UI `llms.txt`
   (`pnpm --filter @lumiose/ui docs:gen`). The page, its navigation entry and its gallery cell
   then appear on their own.
2. Run `pnpm --filter @lumiose/web ui:demos` and commit `src/ui-demos/`.
   `src/content/ui-demos.test.ts` fails in `pnpm check` until the generated demos match the
   examples. Two examples must not export the same name.
3. Add the page to `PAGES` and `OPEN_DEMOS` in `e2e/a11y.e2e.ts`, then run `pnpm test:e2e`.

## Accessibility: WCAG 2.2 AA

Every page meets WCAG 2.2 AA (decision-39). `e2e/a11y.e2e.ts` checks it in the light and the dark
theme on each page type: the landing (its live demo, and the static stand-in that visitors without
JavaScript see), a docs page, the docs and diagnostics indexes, a diagnostic page, the benchmarks,
a benchmark report, the showcase with the demos, the playground, the 404, and the `/ui` pages (each
component's first demo also open).

- **axe** fails on any violation tagged `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` or `wcag22aa`.
- **Needs review.** Axe cannot compute contrast over a gradient or a pseudo-element, so it reports
  those nodes as "needs review". The suite prints them, grouped by reason. They are then checked
  again with each decorative layer replaced by a solid color at its strongest point (`FLATTENED`
  in the test):
  - the glows at their peak
  - the translucent sticky header over the page's darkest or lightest content
  - both ends of the primary button and gradient text gradients

  A new gradient, glow or translucent layer behind text needs an entry in `FLATTENED`.

- **The beams of light.** Axe cannot see the beams behind the text (`src/components/Beams.stsx`, an
  SVG behind every page). A test sets every beam to the top of its pulse, hides the text, and
  captures the landing, docs, `/ui`, benchmarks and playground pages with and without the beams, at
  1440, 820 and 390 px in both themes. The pixels that differ inside a text's box are the beams
  behind it; each must keep 4.5:1 with the text's color, large text included. It prints the lowest
  ratio it found. Other tests check that the "Pause background animation" checkbox pauses the
  beams, also without JavaScript, and that reduced motion leaves them still.

- **Motion.** Apart from the beams, which have their pause control, no animation runs longer than
  5 seconds, and none runs longer than 1 second under `prefers-reduced-motion: reduce`.
- **Focus.** Tabbing through the landing, a docs page, the showcase and the benchmarks, every
  focused element changes how it, or a near ancestor such as a card, looks. No focused element
  below the header is covered by it.
- **Reflow and text spacing.** At 320 px a docs page and the `/ui` pages scroll only vertically,
  also with WCAG's text-spacing overrides (code blocks and wide tables scroll in their own boxes).
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
