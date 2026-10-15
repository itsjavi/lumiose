---
id: TASK-332
title: 'Spike: depend on, port or merge Timeless for @lumiose/ui'
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-15 04:03'
updated_date: '2026-10-15 12:36'
labels:
  - proposal
  - needs-decision
  - ui
milestone: m-12
dependencies: []
priority: high
ordinal: 334000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-54, @lumiose/ui follows Timeless (timeless.build): native-first custom elements in the light DOM and CSS over native HTML, server-rendered without hydration, with Base UI's part anatomy and data attributes as API inspiration and Zag.js considered later for widgets Timeless lacks. Timeless is young (0.2.0), so compare: (a) depending on @timelessui/components, (b) porting its philosophy and code into @lumiose/ui, (c) merging Timeless into this monorepo. Prototype dialog, menu and combobox for the viable options and compare coupling, release cadence, server rendering without hydration, the glue with signals and bind:, bundle size, accessibility testing and maintenance. The result is a proposal for the user, including the component API shape.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dialog, menu and combobox are prototyped for each viable option
- [ ] #2 A comparison on the criteria above and a recommended option with its API shape are reviewed by the user
- [ ] #3 The approved option is recorded as a decision and M12's implementation tasks are created
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Lux, orchestrator): the user started the spike with workers; Halo (owner of the design system, @lumiose/site-kit) runs it and returns the proposal for the user's review.

2026-10-15 (Halo): claimed; spike started in a worktree (branch claude/halo-t332-91e4c1).

2026-10-15 (Halo): spike done; the proposal below waits for the user (AC #2). Nothing is filed upstream and no decision or implementation task is created.

## Proposal: depend on, port or merge Timeless (TASK-332)

**Recommendation: (b), port Timeless's approach into @lumiose/ui.** Keep its philosophy (light-DOM custom elements only where the platform falls short, native dialog/popover/invoker commands/anchor positioning, CSS in token/core/theme tiers inside cascade layers, APG keyboard contracts), and write the elements for Lumiose: contracts shaped for signals, no decorators, Base UI part names.

Prototypes: `examples/ui-spike` (committed, throwaway; the e2e suite and size script make the numbers reproducible). One component API (`src/api.ts`), two implementations: (a) `src/option-a` on @timelessui/components 0.2.0, (b) `src/option-b` on the port. `/a` and `/b` are server components (no island); `/a/signals` and `/b/signals` render the same widgets in an island bound to signals. Option (c) is (a) with `TIMELESS_SRC=<a Timeless checkout>`, which resolves Timeless to its TypeScript sources as workspace packages would after a merge.

Screenshots: [(a) Timeless](../assets/task-332-option-a.png), [(b) port](../assets/task-332-option-b.png) (menu, combobox and alert dialog open, server-rendered, no hydration).

### Comparison

| Criterion | (a) Depend on @timelessui/components 0.2.0 | (b) Port into @lumiose/ui | (c) Merge Timeless into this monorepo |
| --- | --- | --- | --- |
| Coupling | @lumiose/ui's DOM contract is Timeless's (`ui-*` tags, `data-ui-part`, `ui-*` events, combobox value = input text). Each Lumiose need is an upstream change and release in a second repo. | Own contract, designed for signals and Base UI parts. Timeless is the reference, not a dependency. | One repo, two products: Lumiose-driven changes must keep Timeless's React, Preact, Solid, Vue and Svelte adapters and its site working. |
| Release cadence | Timeless: 55 commits, 0.0.1 to 0.2.0 on 2026-08-21, no push since. Lumiose: 0.1.0 to 0.4.0 between 2026-10-10 and 10-14, about 1,170 commits in the last month. | @lumiose/ui's own 0.x line (decision-54), no external waits. | Timeless enters this repo's flow but keeps a separate npm line to version. |
| Server rendering without hydration | Works: the server HTML upgrades in place; dialog and menu open before JS through invoker commands and `popovertarget` (the wrapper must author `popovertarget`; Timeless's own menu-button markup does not). | Works. The dialog ships **no JS** (native `<dialog>`, invoker commands, `closedby`); menu and combobox upgrade in place. | Same as (a) once built. From source it does not build (toolchain row). |
| Islands over upgraded elements | No LUM4006: Timeless's upgrade adds ids and ARIA attributes, the node structure stays. | Same. | Same as (a). |
| Glue with signals and `bind:` | Works through wrappers, with gaps: (1) `ui-dialog` has no `open` property, so opening from a signal bypasses Timeless and the trigger keeps `aria-expanded="false"`; (2) combobox `value` is the input text, so the input shows `berlin`, not `Berlin`; (3) setting `value` does not move `aria-selected` (stayed on Berlin after `value = "lisbon"`); (4) checkbox items report `ui-change` on the menu, each item filters by `detail.item`. | Works, no gaps found: `open` property + `openchange` event; combobox `value` property + `change` only on a new selection (the inner input's `change` stays inside) + form value through ElementInternals; `checkedchange` on the item. Listeners are delegated and items queried per event, so Lumiose may rerender children (an option added by the island is filtered and selectable). | Same as (a). |
| JS per widget, min / gzip / brotli (`pnpm size`) | dialog 14.73 / 5.14 / **4.64 kB**; menu 30.78 / 8.51 / **7.66**; combobox 47.11 / 12.44 / **11.06**; all three 70.21 / 16.55 / **14.75** | dialog **0**; menu 2.40 / 1.05 / **0.89**; combobox 3.13 / 1.28 / **1.09**; all three 5.53 / 1.94 / **1.71** | Same as (a) (built with Timeless's tsdown). |
| CSS, min / gzip / brotli | tokens + core + Atmosphere for these widgets: 32.70 / 5.41 / 4.77 kB | spike theme: 3.24 / 1.06 / 0.91 kB (fewer states than Atmosphere) | Same as (a). |
| Built page transfer (brotli, `lumiose build`, Chromium) | `/a`: JS 26.0 kB = runtime 10.8 (finding F1) + elements 14.7 + 0.4; CSS 4.8 | `/b`: JS 13.0 kB = runtime 10.8 (F1) + elements 1.7 + 0.4; CSS 0.9 (inlined) | — |
| Accessibility | axe-core 4.13: 0 violations closed and with the dialog, menu and listbox open. Keyboard paths pass, except that running a menu item leaves the menu open (the APG closes it and refocuses the trigger); on a server page no wrapper code can patch it. Kept as an expected failure in the suite. | axe-core 4.13: 0 violations in the same states. All keyboard paths pass (list below). | Same as (a). |
| Toolchain fit | The npm build is lowered JS: fine. | Erasable TS, no decorators: runs through Node's type stripping, Vitest and Vite like the rest of the repo. | Timeless uses TC39 decorators (`@element`, `@attr accessor`). From source, Vite 8 keeps them verbatim: the SSR build throws `SyntaxError` in Node 26.8.1, and Chrome 152 cannot parse them either. Timeless's `sideEffects` lists only `dist/`, so the bundler drops the source `register/*` modules (the spike marks them by hand). A merge keeps Timeless's tsdown build, scripts, StoryLite stories app, web app and e2e app in this repo, or rewrites the decorators away, which is (b). |
| Maintenance | Least code here: Timeless has about 20k lines of TS, 5.5k of CSS, a 1k-line core and 48 test files, maintained upstream. Each gap costs a cross-repo change and the user's time on a second release train. | We own it: the spike is 370 lines of elements and 360 of components for three widgets; the M12 set is perhaps 3 to 5k lines plus tests. Fixes do not flow to Timeless by themselves. | The largest surface for this repo's agents and CI: all of Timeless's code, apps, contract scripts and framework adapters. |

Keyboard paths checked in both options (Playwright, real key events): dialog: Enter on the trigger opens it, focus on the first button, Tab moves inside, Escape closes, focus returns to the trigger, role `alertdialog` with name and description; menu: Enter opens on the first item that can run, Arrow Up opens on the last, arrows, Home, End and typeahead move focus (disabled items stay reachable), Escape closes and refocuses the trigger, `aria-expanded` follows; combobox: typing filters (contains), Arrow Down moves `aria-activedescendant`, Enter selects (`aria-selected`), `aria-expanded` follows, focus stays in the input. Without JavaScript, in both: the dialog opens and closes with Escape, the menu opens.

### Why (b)

1. **Contracts.** Every gap found with (a) sits in the element contracts, and each needs an upstream release before @lumiose/ui can ship around it. With (b) the contracts are designed once for signals, `bind:` and Base UI's model.
2. **Size.** 8.6 times less JS for the three widgets (1.71 against 14.75 kB brotli), and none for a dialog. The port is a subset (no submenus, radio items, groups, empty and status regions, multiple selection, placement fallback, cross-realm support); a complete version should stay around 4 to 6 kB brotli for these three.
3. **Toolchain.** No decorators, no second build: the code runs and is tested like the rest of the monorepo. (c) cannot consume Timeless from source.
4. **It is still Timeless.** Same philosophy, same CSS architecture, same APG contracts; the port reuses Timeless's keyboard-contract cases and its notes (MIT, same author), and credits it.

**Alternatives.** (a) stays viable if the user wants Timeless to be the shared engine for every framework: it first needs the upstream changes U1 to U4 and costs about 15 kB brotli of JS for these three widgets. (c) makes sense only if the user wants to retire Timeless as a separate project; in practice it becomes (b) plus moving Timeless's site and adapters here.

### API shape (proposal; names need the user's approval, decision-16, decision-32, decision-35)

```tsx
import { Combobox, Dialog, Menu } from "@lumiose/ui";

<Dialog.Root role="alertdialog" open={open()} onOpenChange={(next) => open.set(next)}>
  <Dialog.Trigger>Delete project…</Dialog.Trigger>
  <Dialog.Popup>
    <Dialog.Title>Delete project?</Dialog.Title>
    <Dialog.Description>This removes the project and its deployments.</Dialog.Description>
    <Dialog.Close value="cancel">Cancel</Dialog.Close>
    <Dialog.Close value="delete">Delete</Dialog.Close>
  </Dialog.Popup>
</Dialog.Root>;

<Menu.Root>
  <Menu.Trigger>Actions</Menu.Trigger>
  <Menu.Popup>
    <Menu.Item onClick={rename}>Rename</Menu.Item>
    <Menu.Separator />
    <Menu.CheckboxItem checked={archived()} onCheckedChange={(next) => archived.set(next)}>
      Show archived
    </Menu.CheckboxItem>
    <Menu.Item disabled>Delete</Menu.Item>
  </Menu.Popup>
</Menu.Root>;

<Combobox.Root name="city" value={city()} onValueChange={(next) => city.set(next)}>
  <Combobox.Label>City</Combobox.Label>
  <Combobox.Input placeholder="Search cities" />
  <Combobox.List>
    {cities.map((item) => <Combobox.Item value={item.value}>{item.label}</Combobox.Item>)}
  </Combobox.List>
</Combobox.Root>;
```

| Component | Parts and what they render | Props | Element contract |
| --- | --- | --- | --- |
| Dialog | `Root` (no element), `Trigger` (`button command="show-modal"`), `Popup` (`dialog` with `role`, `closedby`, `aria-labelledby`, `aria-describedby`), `Title` (`h2`), `Description` (`p`), `Close` (`button command="close"`, `value` becomes `returnValue`) | Root: `open`, `onOpenChange(open)`, `role` (`"dialog"` or `"alertdialog"`) | No custom element, no JS. The native dialog is the state; its `toggle` event is the single source of `onOpenChange`, whether the trigger, a close button, Escape or a signal opened or closed it. |
| Menu | `Root` (`lu-menu`, `display: contents`), `Trigger` (`button popovertarget`, `aria-haspopup="menu"`, `anchor-name`), `Popup` (`div role="menu" popover="auto"`, `position-anchor`), `Item` (`button role="menuitem" tabindex="-1"`), `CheckboxItem` (`role="menuitemcheckbox"`, `aria-checked`), `Separator` | Root: `open`, `onOpenChange`. Popup: `aria-label`. Item: `onClick`, `disabled`. CheckboxItem: `checked`, `onCheckedChange`, `disabled` | `lu-menu`: property `open`; event `openchange` (`detail.open`); items dispatch `checkedchange` (`detail.checked`). |
| Combobox | `Root` (`lu-combobox`, form-associated), `Label` (`label`), `Input` (`input role="combobox" aria-autocomplete="list"`, `anchor-name`), `List` (`div role="listbox" popover="manual"`), `Item` (`div role="option" data-value`, `aria-selected`) | Root: `value`, `defaultValue`, `onValueChange(value)`, `name`, `required`. Item: `value`, `disabled` | `lu-combobox`: properties `value`, `name`, `required`; event `change` for a new selection only; the input shows the option's label; submits `value` under `name`. |

- **Every part** passes the native element's props through (`class`, `style`, `aria-*`, handlers), so a part is styled and extended like the element it renders.
- **Differences from Base UI.** No `Portal`, `Positioner` or `Backdrop` parts: the top layer, CSS anchor positioning and `::backdrop` replace them; placement props (`side`, `align`, `sideOffset`) would go on `Popup`. `Combobox.List` is Base UI's `Popup` and `List` in one element; a `Combobox.Popup` joins when a header, footer or empty state sits beside the list. `Combobox.Label` is added (Base UI uses `Field.Label`). An alert dialog is `role="alertdialog"` on `Dialog.Root`, where Base UI has a separate `AlertDialog`.
- **Styling hooks.** Native and ARIA state first: `dialog[open]`, `:popover-open`, `[aria-expanded]`, `[aria-checked]`, `[aria-selected]`, `[aria-disabled]`; Base UI's `data-highlighted` on the active option; later `data-side` and `data-align`. CSS ships in Timeless's tiers as layers (`lu.tokens`, `lu.core` for required behaviour such as display and anchoring, `lu.theme` for the replaceable look), so unlayered app CSS always wins.
- **Signals.** Controlled props read signals (`open={open()}`) and the callbacks write them; leaving them out keeps the state in the element. Proposal, a syntax decision: `bind:open={open}`, `bind:value={city}` and `bind:checked={archived}` on components that follow the `x` plus `onXChange` convention, and on custom elements with an `x` property and a `change` event (the combobox already behaves like a native control for that).
- **Server components.** Dialog needs nothing in the browser. A page that renders a Menu or Combobox needs the element definitions without an island (I3); the spike loads them from `instrumentation.client.ts` by path.

**Open naming questions for the user:** the tag prefix (`lu-` in the spike; `l-`, `lumiose-`; `ui-` would collide with Timeless on the same page); the event names (`openchange`, `checkedchange`, `change`); `role="alertdialog"` against an `AlertDialog` component; whether themes get a part attribute (none, as Base UI, or `data-part`, as Timeless's `data-ui-part`).

### Upstream notes for Timeless (drafts for the user's review; nothing filed)

- **U1** `ui-menu-button`: close the menu and return focus to the trigger when an item runs (click, Enter, Space), as the APG Menu Button pattern asks. Today the menu stays open.
- **U2** `ui-dialog`: an `open` property, or state derived from the dialog's `toggle` event, so a programmatic `showModal()` or `close()` keeps the trigger's `aria-expanded` and the focus return in sync.
- **U3** `ui-combobox`: setting `value` should update `aria-selected`; consider a value and label split (the input shows the option's label, `value` is its `data-ui-value`).
- **U4** Menu Button markup: author `popovertarget` on the trigger in the examples, so the documented "Enter and Space open through `popovertarget` before any script runs" holds.
- **U5** Only for source consumption: `sideEffects` lists `dist/` files only, and the TC39 decorators reach consumers unlowered.

### Lumiose findings (proposed tasks, needed whichever option wins)

- **F1** (Nova, build): an `instrumentation.client.ts` with a dynamic `import()` makes island-free pages download the 30.5 kB (10.8 kB brotli) runtime chunk, with a `modulepreload` for it, because Vite's preload helper is grouped into that chunk.
- **F2** (Nova, Photon): there is no way to ship a custom element's definition with a server-rendered page that has no island. @lumiose/ui needs per-page client modules for the components a page imports, collected like CSS.
- **F3** (Photon, Spark): `<button {...props} />` drops `props.children`; React and Solid render it. Undocumented.
- **F4** (Photon): statement destructuring, `const { children, ...rest } = props`, reads `children` eagerly; in an island the children render before their parent claims its nodes, which ends in LUM4006. Parameter destructuring is rewritten and safe; the statement form needs the same rewrite or a diagnostic.
- **F5** (Photon): LUM2001 false positive: `const context = { id: useId() }` used in JSX is reported as a stale signal read.

### Implementation tasks (to create after the decision, AC #3)

- **I1** (Lux) The decision record: the option, the names and the API shape.
- **I2** (Halo) Scaffold `packages/ui` (@lumiose/ui): exports, its own 0.x line (TASK-333), a size budget in `pnpm size` (decision-55), the docs section.
- **I3** (Nova, Photon) Element definitions shipped with server-rendered pages (F2), and F1.
- **I4** (Halo) Dialog and alert dialog, no JS.
- **I5** (Halo) Popover and Tooltip.
- **I6** (Halo) Menu: groups and group labels, radio items, submenus, placement.
- **I7** (Halo) Combobox and Select: groups, empty and status, clear, multiple with chips, validation, async options.
- **I8** (Halo) Tabs.
- **I9** (Photon) `bind:` on components and custom elements, only if the user approves the syntax.
- **I10** (Halo) Test kit: keyboard-contract and axe Playwright suites per component in CI (port Timeless's contract cases); before 0.1.0, a screen reader pass (VoiceOver, NVDA) and Firefox and WebKit runs.
- **I11** (Photon, Spark) F3 to F5.
- **I12** (Halo, Beacon) Docs per component; @lumiose/site-kit and apps/web adopt the widgets.
- **I13** (Lux) Delete `examples/ui-spike` once I4, I6 and I7 replace it.

### Limits

- (b) covers a subset of Timeless's features; its sizes are for that subset.
- Only Chromium 152 (Playwright 1.63): no Firefox or WebKit, no screen reader, forced colors or touch checks.
- (c) was tried as "consume Timeless from source with Lumiose's toolchain", not as a full merge.
- Sizes are single builds of bundle bytes; there is no speed claim, so no A/B was needed.

### Reproduce

- `pnpm --filter @lumiose-examples/ui-spike dev`, then `/a`, `/b`, `/a/signals`, `/b/signals`.
- `pnpm --filter @lumiose-examples/ui-spike size` prints the size table.
- `pnpm --filter @lumiose-examples/ui-spike test:e2e`: 28 tests (dev and build), axe included; the (a) menu-close test is an expected failure.
- Option (c): `TIMELESS_SRC=<Timeless checkout> pnpm exec lumiose build` in the example, then `lumiose preview` (the server fails with the decorator `SyntaxError`).

2026-10-15 (Lux): the spike's Lumiose findings are tasks: F1 TASK-346, F3 TASK-347, F4 TASK-348, F5 TASK-349; F2 went to TASK-283. Waiting for the user's review of the proposal (AC #2 and #3).
<!-- SECTION:NOTES:END -->
