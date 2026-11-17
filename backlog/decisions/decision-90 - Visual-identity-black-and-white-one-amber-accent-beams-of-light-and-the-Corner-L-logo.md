---
id: decision-90
title: >-
  Visual identity: black and white, one amber accent, beams of light and the
  Corner L logo
date: '2026-11-17T12:28:00Z'
status: accepted
---
## Context

On 2026-11-17 the user asked for a full redesign of the landing page, the docs, the branding and the look of `@lumiose/ui`:

- The pages are bloated and overwhelming, and the docs are hard to read: long blocks of text with too few examples.
- Coloured, styled components read as opinionated styles handed to users. shadcn/ui and Base UI show the cleaner approach: plain black and white.
- The name should show as light: rays in a corner, animated, in one warm colour.

Two click dummies were compared. The user chose variant B, "First light", then asked for a gallery of all components, accessible greys, no sun disc in the corner, and a new logo, chosen from four options. The agreed dummy is `backlog/assets/redesign/b-first-light.html`; the logo options are in `backlog/assets/redesign/logos.html`.

## Decision

**Palette.** Black and white, one mid grey for secondary text, hairline and soft-surface greys, and one warm amber accent. Both themes exist.

| Token            | Dark      | Light     |
| ---------------- | --------- | --------- |
| Background       | `#000`    | `#fff`    |
| Text             | `#fff`    | `#000`    |
| Grey (secondary) | `#a3a3a3` | `#595959` |
| Accent           | `#ffd27a` | `#f5a300` |

**The accent is rare.** It appears in the beams, the logo, the marker of the active navigation item, and emphasis in code. It is never a text colour and never a focus ring.

**Light.** Thin amber beams and faint arcs fan out from the top-left corner, behind the logo, and pulse slowly. There is no sun disc. The beams fade before they reach body text and are dimmer on inner pages than on the landing. This replaces the three.js light source of decision-37's "Lumen" direction. The pause control and reduced-motion rule of decision-39 stay.

**Accessibility.** Text keeps at least 4.5:1 against what is behind it, a beam at its brightest included; the grey reaches 7:1 on the page background. Focus rings and control borders keep 3:1. State is never shown by colour alone.

**Shape and type.** Square corners, hairline borders, no shadows and no gradients. Large, tight sans headings; small mono uppercase labels. Code highlighting keeps syntax colours, the only hues besides the accent (amended by the user on 2026-11-17, after the monochrome highlighting of the first build read as "no highlighting").

**Logo.** "Corner L": a capital L as a wall and a floor, with an amber quarter of light in the corner, beside the wordmark in mono uppercase. It ships only after a check against existing logos and trademarks (TASK-603).

**Landing.** A left-aligned hero beside one live code example, four numbered rows with one sentence and one link each (Write, Render, Hydrate, Measure), a strip of live UI components and a closing install box. The stack table moves to `/benchmarks` (user, 2026-11-17), which amends the landing structure of decision-37. Its positioning, tagline and descriptor are unchanged.

**Docs.** Words on the left, the code they describe on the right, and the result shown. Pages lead with an example and keep prose short; requirements and edge cases move to callouts and reference pages. Step pages get a step bar. The layout comes from the existing Markdown structure; it adds no authoring syntax.

**UI library.** The default theme of `@lumiose/ui` is plain black and white with one overridable accent. `/ui` opens on a gallery of every component, live; a component page shows a preview, usage and props.

## Consequences

- Milestone M16 carries the work: TASK-602 to TASK-615.
- The three.js light source and its island go away, which removes that dependency from the site if nothing else uses it.
- The default look of `@lumiose/ui` changes for projects that use the default theme. The package's changelog notes it.
- The docs rewrite touches most pages. A pilot (TASK-609) is reviewed by the user before the rest starts.
- The dummy's copy, version label and UI usage samples are placeholders; real pages keep taking code and numbers from the compiler and the committed results.

