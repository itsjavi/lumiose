---
id: TASK-370
title: Accordion and Collapsible
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 16:54'
updated_date: '2026-10-15 22:26'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
priority: high
ordinal: 371000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Collapsible and Accordion on native details/summary where possible (exclusive groups with details name), with open/onOpenChange, keyboard contract and height animation through CSS variables.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Parts, props and events follow Base UI's anatomy within decision-62 (lu- tags, lowercase events, bind: by convention)
- [x] #2 Unstyled: the package ships only the CSS the primitive needs to work (display, positioning, CSS variables), in one low-priority layer
- [x] #3 Passes every item of the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) that applies, plus keyboard-contract and axe tests
- [x] #4 A docs page with a type-checked example
- [x] #5 Meets WCAG 2.2 AA (doc-9 section 17): axe with the WCAG A and AA tags passes closed and open, with the default theme, in light and dark, and the manual criteria that apply are checked and recorded
- [x] #6 Its docs page in packages/ui/docs follows the component template (decision-64) and is listed in @lumiose/ui's llms.txt
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15: the pitfall checklist is doc-9. The component gets its rules in the optional default theme (@lumiose/ui/themes/default.css, decision-62); the component itself stays unstyled.

2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17).

2026-10-15 (user): @lumiose/ui is agent-ready like lumiose (decision-64). The component's docs page lives in packages/ui/docs/<component>.md, follows dialog.md's sections (Anatomy, API, Example, Styling, Keyboard and focus, Without JavaScript, Browser support, Related) and is listed in the UI llms.txt.

2026-10-15 (Lux, orchestrator): reassigned to Spark, so it runs in parallel with Halo's form controls (TASK-365 to TASK-368). Spark may edit packages/ui/src/<component>/**, the component's docs page and e2e, and add its lines to the shared package files (index.ts, package.json exports, styles.css, themes/default.css, scripts/size.ts, docs README and theming tables).

2026-10-15 (Lux, orchestrator): reassigned to Beacon instead. New sessions cannot start from an automated turn, so the idle Beacon session takes it. The same edit areas apply.

2026-10-15 (Beacon, branch claude/beacon-m12b-ee0e55): implemented.

Design (orchestrator-delegated technical decisions):
- Native first. Collapsible.Root is a `<details>`, Trigger its `<summary>`, Panel a `<div>`. Accordion.Root is `<lu-accordion>`, Item a `<details>` directly inside it with `name` = the root's id (the browser's exclusive group) unless `multiple`, Trigger a `<summary>`, Panel a `<div role="region" aria-labelledby>`. Opening, closing, exclusivity, find-in-page and fragment links work in server HTML with no JavaScript.
- Header: HTML allows a heading inside a `<summary>`, not a `<summary>` inside a heading. So Accordion.Header renders no element of its own: it passes its props to the `<h3>` that Trigger renders inside the `<summary>`. Base UI's anatomy (Header around Trigger) is kept. Another level: `aria-level` on Header. Chromium exposes the heading (the e2e finds `heading` level 3).
- Scripts (decision-63): collapsible.script (0.69 kB brotli) sets the animation hooks and the disabled guard. accordion.script (1.04 kB) defines `lu-accordion` with the arrow keys, Home and End, plus the same hooks. Both share ../collapsible/panel.ts.
- Animation, Base UI's hooks: `--collapsible-panel-height`/`-width` (`--accordion-panel-…`) on the panel, set to the content's px while it moves and to `auto` once open, plus `data-starting-style` and `data-ending-style`.
  - One MutationObserver watches the `open` attribute: whatever opens a panel, the opening starts from the starting style.
  - Closing needs `::details-content`'s `content-visibility` to transition (allow-discrete), as the default theme does.
  - A panel rendered open does not animate. An interrupted change starts from where it is.
  - New shared module src/animation/animation.ts: no requestAnimationFrame (a background page renders no frames). It flushes style and waits for the animations' computed remaining time through a timer. Toast uses it too.
- Disabled triggers: `aria-disabled="true"` + `tabindex="-1"` on the summary. lu.core makes them ignore the pointer, so this works without JS. The script blocks the click (Enter and Space click a summary too).
- Not offered, against Base UI:
  - `hiddenUntilFound` and `keepMounted`: a `<details>` panel is always in the DOM and always revealable.
  - Manual ids on the parts: the server renders the trigger's `aria-controls` before the panel. Ids stay the parts' own, as in Dialog and Popover.
- bind: `bind:open` on Collapsible.Root, `bind:value` (string[]) on Accordion.Root. The props types drop the intrinsic brand (like Tabs/Combobox) so bind: applies.

doc-9 §9:
- [x] `aria-controls` on triggers; panels labelled by their trigger (the accordion's regions). The expanded state is the `<summary>`'s native one: no explicit `aria-expanded`, which server HTML would leave stale without JS.
  - Manual ids: not supported (divergence above).
- [x] Down/Up (Right/Left when horizontal, swapped in RTL), Home/End move between triggers. Disabled triggers are skipped and out of the tab order.
- [x] Find-in-page: the `<details>`' own revealing (no `hidden="until-found"` needed): Chrome 97, Firefox 139; Safari not yet (WebKit bug 304174). The e2e checks fragment links: the panel opens, and in an exclusive group the other closes.
- [x] Height animation: measured variable, none when starting open, interruptions start from where they are, panel always mounted.
- Native gaps:
  - arrow keys: script;
  - forbidding collapse of the last item: not offered, like Base UI and Zag's `collapsible: true`;
  - height animation: script + `::details-content`;
  - heading inside summary: verified in Chromium's accessibility tree; screen readers not checked here.
- §1, the parts that apply:
  - [x] animations stay mounted until they settle, no enter animation when rendered open, interruptions handled;
  - [x] deterministic ids (`useId`);
  - [x] RTL arrows.

Against Base UI and Zag:
- Base UI Collapsible: Root (open, defaultOpen, onOpenChange, disabled), Trigger, Panel (hiddenUntilFound, keepMounted). Same here, minus the panel props.
- Base UI Accordion: Root (value[], defaultValue, onValueChange, multiple=false, disabled, orientation, loopFocus, hiddenUntilFound, keepMounted), Item (value, disabled, onOpenChange), Header (h3), Trigger (button), Panel (region).
  - Same here, minus hiddenUntilFound and keepMounted.
  - The trigger is a `<summary>` with the heading inside, not a button inside a heading.
- Zag: single mode can always close the open item (Zag's `collapsible: true`). Same keys.

WCAG 2.2 AA (doc-9 §17):
- Automated (examples/ui-e2e, dev and build), for both components:
  - axe with the WCAG A and AA tags, closed and open, light and dark;
  - a 2px focus ring;
  - targets ≥ 24px (the theme's triggers are 36px tall);
  - reflow at 320px and text spacing.
- Manual (checked):
  - 2.1.1/2.1.2: every action from the keyboard, no trap.
  - 2.4.3: triggers, then the open panel's content.
  - 2.4.7: the theme's ring.
  - 1.4.1: a chevron shape that turns, plus the native expanded state.
  - 1.4.11: the chevron is currentColor (the foreground).
  - 4.1.2: the native expanded state, and labelled regions.
  - 3.2.1: focus never toggles.
  - Disabled triggers are dimmed: inactive components are exempt from 1.4.3.
  - Not applicable: 1.4.13, 2.5.x.
- Not verified here: how screen readers read a heading inside a `<summary>`.

Public names (proposals, TASK-400):
- Exports `Collapsible`, `Accordion`; entries `@lumiose/ui/collapsible`, `/collapsible.css`, `/accordion`, `/accordion.css`.
- Parts as in Base UI.
- Props:
  - Collapsible.Root: open, defaultOpen, onOpenChange, disabled.
  - Accordion.Root: value, defaultValue, onValueChange, multiple, disabled, orientation, loopFocus.
  - Item: value, disabled, onOpenChange.
- Element `lu-accordion`, with `data-orientation="horizontal"` and `data-loop-focus="false"`.
- Variables `--collapsible-panel-height`/`-width` and `--accordion-panel-height`/`-width` (Base UI's names); `data-starting-style` and `data-ending-style` on panels.
- Theme classes `lu-collapsible`, `lu-accordion`.
- Types `Collapsible{Root,Trigger,Panel}Props`, `Accordion{Root,Item,Header,Trigger,Panel}Props`.

Validation 2026-10-16:
- pnpm check green: Vitest 2190 passed, 2 skipped; typecheck, lint, fmt:examples, size, cargo test.
- pack:check --smoke --skip-npm green: @lumiose/ui packs 57 files; the smoke app builds and passes its browser test.
- ui-e2e, every component, dev and build: 338 passed, 8 skipped by design.
- apps/web Playwright: the a11y suite 76 passed; the rest of the suite passed in the run before the last fix, and its UI suite twice since. No Rust changes.
- Screenshots: backlog/assets/task-370-{accordion,collapsible}-{light,dark}.png.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Collapsible and Accordion ship in @lumiose/ui on native <details>. The summary toggles the panel in server HTML; an accordion's items are the browser's exclusive group (name) unless multiple; find-in-page and links open them; Accordion.Header's <h3> sits inside the summary. Small client scripts add Base UI's animation hooks (--collapsible-panel-height, --accordion-panel-height, data-starting-style, data-ending-style), block disabled triggers, and give <lu-accordion> the APG arrow keys. bind:open and bind:value sync signals. Docs pages, theme blocks (lu-collapsible, lu-accordion), live demos on /ui, and keyboard, axe and reflow tests are in.
<!-- SECTION:FINAL_SUMMARY:END -->
