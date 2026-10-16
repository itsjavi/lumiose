# Tabs

> A tab list and the panel of the selected tab, after the WAI-ARIA tabs pattern: the server HTML holds the whole state (roles, `aria-selected`, the roving tab stop, the hidden panels), and `<lu-tabs>`, a 1.2 kB light-DOM element, adds the arrow keys and the selection. Manual or automatic activation, horizontal or vertical, right-to-left aware, with an optional indicator that slides to the selected tab; `bind:value` (or `value` and `onValueChange`) keeps a signal in sync.

```ts
import { Tabs } from "@lumiose/ui"; // or "@lumiose/ui/tabs"
import "@lumiose/ui/tabs.css"; // makes <lu-tabs> a block and places the indicator
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Tabs.Root>
  <Tabs.List>
    <Tabs.Tab />
    <Tabs.Indicator />
  </Tabs.List>
  <Tabs.Panel />
</Tabs.Root>
```

| Part        | Renders                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Root`      | `<lu-tabs>`, the element that handles the keys and the selection.                                                         |
| `List`      | `<div role="tablist">`, with `aria-orientation="vertical"` when vertical. Name it with `aria-label` or `aria-labelledby`. |
| `Tab`       | `<button type="button" role="tab" value="…" aria-selected="…" aria-controls="…" tabindex="…">`.                           |
| `Indicator` | `<span aria-hidden="true" data-indicator>`, over the selected tab's box and behind its text. Optional.                    |
| `Panel`     | `<div role="tabpanel" tabindex="0" aria-labelledby="…">`, `hidden` unless its tab is selected.                            |

A `Tab` and a `Panel` with the same `value` belong together. Every panel stays in the page, hidden
when its tab is not selected, so the browser can switch them before any script loads.

## API

### Tabs.Root

| Prop            | Type                         | Default               |                                                  |
| --------------- | ---------------------------- | --------------------- | ------------------------------------------------ |
| `value`         | `string`                     |                       | Selects the tab with this value when it changes. |
| `defaultValue`  | `string`                     | the first enabled tab | The tab selected at first, without `value`.      |
| `onValueChange` | `(value: string) => void`    |                       | Called after the user selects another tab.       |
| `bind:value`    | `Signal<string>`             |                       | Stands in for `value` and `onValueChange`.       |
| `orientation`   | `"horizontal" \| "vertical"` | `"horizontal"`        | Which arrow keys move between the tabs.          |

`Root` also takes the props of an element (`class`, `style`, `data-*`, events) and passes them to
`<lu-tabs>`.

### Tabs.List

| Prop              | Type      | Default |                                                                                            |
| ----------------- | --------- | ------- | ------------------------------------------------------------------------------------------ |
| `activateOnFocus` | `boolean` | `false` | Selects a tab as soon as it receives focus (automatic activation), as Zag does by default. |
| `loopFocus`       | `boolean` | `true`  | The arrow keys go from the last tab to the first and back.                                 |

The element reads them from the list's attributes: `data-activate-on-focus` and
`data-loop-focus="false"`.

### Tabs.Tab and Tabs.Panel

| Prop       | On    | Type      |                                                               |
| ---------- | ----- | --------- | ------------------------------------------------------------- |
| `value`    | both  | `string`  | Pairs a tab with its panel. Required.                         |
| `disabled` | `Tab` | `boolean` | The tab takes focus but cannot be selected (`aria-disabled`). |

Each takes the props of the element it renders. `role`, `id`, `value`, `aria-selected`,
`aria-controls`, `aria-labelledby`, `tabindex` on tabs and `hidden` stay the parts' own.

- **Disabled tabs.** A selected tab that becomes disabled gives its selection to the first enabled
  tab. With every tab disabled, none is selected and the first tab is the tab stop. There is one
  tab stop: in the server HTML, the tab `value` or `defaultValue` names (a disabled one keeps it
  until the script selects another), else the first enabled tab; once the script runs, the
  selected tab.
- **The element.** `<lu-tabs>`' `value` property reads and sets the selection, and it fires
  `valuechange` (not bubbling) when the user changes it, so `bind:value` works on the element too.

### Tabs.Indicator

Takes the props of a `<span>`, without children. Put it inside `Tabs.List`, after the tabs. It is
`hidden` while no tab can be selected.

- **Placed before any script.** CSS anchor positioning puts it over the selected tab from the
  server HTML on (the selected tab carries the anchor `Root` names in `--lu-tabs-anchor`), so it
  is in place at the first paint and nothing shifts when the script loads (doc-9 §8).
- **Then measured.** Once `<lu-tabs>`' script runs, it writes the selected tab's box, from the
  list's padding edge, on the Root as `--lu-tabs-indicator-left`, `--lu-tabs-indicator-top`,
  `--lu-tabs-indicator-width` and `--lu-tabs-indicator-height`, and keeps them current as the
  selection changes (a click, the keys, an island), as the list or a tab resizes, and as a `dir`
  attribute changes in the page. The indicator reads them over its anchor, so a `transition` can
  slide it from tab to tab, and they place it in browsers without anchor positioning.
- **Behind the text.** The list isolates its stacking (`isolation: isolate`) and the indicator
  sits at `z-index: -1`, so a highlight never covers a tab's text.

**Differences from Base UI's Tabs.Indicator.** The variables are on the Root, with these names,
instead of Base UI's `--active-tab-*` on the indicator, and there is no `renderBeforeHydration`:
anchor positioning places it from the server HTML. No `data-activation-direction`.

## Example

```tsx check
import { Tabs } from "@lumiose/ui";

export function AccountSettings() {
  return (
    <Tabs.Root class="lu-tabs" defaultValue="account">
      <Tabs.List aria-label="Account settings">
        <Tabs.Tab value="account">Account</Tabs.Tab>
        <Tabs.Tab value="password">Password</Tabs.Tab>
        <Tabs.Tab value="billing" disabled>
          Billing
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="account">Your name and email.</Tabs.Panel>
      <Tabs.Panel value="password">Change your password.</Tabs.Panel>
      <Tabs.Panel value="billing">Invoices and payment methods.</Tabs.Panel>
    </Tabs.Root>
  );
}
```

In an island, bound to a signal: `bind:value={tab}` is short for `value={tab()}` plus
`onValueChange={(next) => tab.set(next)}`.

```tsx check
import { Tabs } from "@lumiose/ui";
import { signal } from "lumiose";

export function Project() {
  const tab = signal("overview");
  return (
    <>
      <Tabs.Root class="lu-tabs" bind:value={tab}>
        <Tabs.List aria-label="Project" activateOnFocus>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="settings">Settings</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="overview">The project at a glance.</Tabs.Panel>
        <Tabs.Panel value="settings">Name and members.</Tabs.Panel>
      </Tabs.Root>
      <button type="button" onClick={() => tab.set("settings")}>
        Open the settings
      </button>
    </>
  );
}
```

With an indicator that slides to the selected tab:

```tsx check
import { Tabs } from "@lumiose/ui";

export function Release() {
  return (
    <Tabs.Root class="lu-tabs" defaultValue="notes">
      <Tabs.List aria-label="Release">
        <Tabs.Tab value="notes">Notes</Tabs.Tab>
        <Tabs.Tab value="changelog">Full changelog</Tabs.Tab>
        <Tabs.Indicator />
      </Tabs.List>
      <Tabs.Panel value="notes">The highlights.</Tabs.Panel>
      <Tabs.Panel value="changelog">Every change.</Tabs.Panel>
    </Tabs.Root>
  );
}
```

## Styling

**With the default theme**, put `lu-tabs` on `Root`: tabs in a row (or a column when vertical)
over a rule, the selected one underlined (beside it when vertical) in the foreground colour,
disabled ones faded, and focus rings on tabs and panels. The list wraps on narrow screens. With a
`Tabs.Indicator`, the indicator draws that bar and slides to the next tab in 0.2s (at once where
motion is reduced).

**With your own CSS**, style the parts through `class` and their state: `[role="tab"]`,
`[aria-selected="true"]`, `[aria-disabled="true"]`, `[role="tablist"][aria-orientation="vertical"]`
and `[role="tabpanel"]`. Mark the selected tab with more than a colour (WCAG 1.4.1), such as a bar
or a weight, at 3:1 against its background (WCAG 1.4.11).

```css
.tabs [role="tab"] {
  padding: 0.5rem 1rem;
  border: 0;
  background: none;
  color: #52525b;
}
.tabs [role="tab"][aria-selected="true"] {
  color: #09090b;
  box-shadow: inset 0 -2px currentColor;
}
```

A highlight behind the selected tab, with `Tabs.Indicator`:

```css
.tabs [data-indicator] {
  border-radius: 6px;
  background: #f4f4f5;
  transition:
    left 0.2s,
    width 0.2s;
}
```

`@lumiose/ui/tabs.css` (0.3 kB brotli), in the `lu.core` layer, makes `<lu-tabs>` a block and
places the indicator: over the selected tab, behind the tabs' text, from `--lu-tabs-anchor` and the
script's `--lu-tabs-indicator-*` variables.

## Keyboard and focus

The [WAI-ARIA tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/):

| Key                   | Does                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| Tab                   | Into the list, onto the selected tab; out of it, onto the panel.                                   |
| ArrowRight, ArrowLeft | The next or previous tab (horizontal). Swapped in right-to-left. Loops unless `loopFocus={false}`. |
| ArrowDown, ArrowUp    | The next or previous tab (vertical).                                                               |
| Home, End             | The first or last tab.                                                                             |
| Enter, Space          | Selects the focused tab (manual activation).                                                       |

- **Manual activation** (the default, as in Base UI): the arrows move focus and Enter, Space or a
  click selects. With `activateOnFocus`, moving focus selects too. Either way only the panels
  change: nothing navigates or submits.
- **Only the main button** selects: a right-click does not. Disabled tabs take focus but are
  never selected.
- The arrow keys do nothing while an input method is composing, or with Alt, Ctrl or Meta held.

## Without JavaScript, and the element's script

The server HTML is complete: the selected tab, its panel and the tab stop are right before any
script loads, and the panels of the other tabs are `hidden`. Selecting another tab needs
`<lu-tabs>`' script, a 1.2 kB (brotli) module that a page rendering `Tabs` loads once, without
the Lumiose runtime; islands bundle it. A `Tabs.Indicator` is placed by CSS alone until then; the
script makes it follow a new selection. `value`, `onValueChange` and `bind:value` need the
component to run in an island.

## Browser support

- **Custom elements** (`<lu-tabs>`) and everything the element uses: every current browser.
- The default theme's vertical tabs follow the direction with logical properties
  (`border-inline-end`): every current browser.
- **CSS anchor positioning** places `Tabs.Indicator` before the script runs: Chrome and Edge 125,
  Firefox 147, Safari 26. Elsewhere it appears once the script has measured the selected tab.

## Related

- [UI components](README.md): the approach, styling, the default theme and the other components.
- [Web components](https://itsjavi.com/lumiose/docs/guides/web-components/): custom elements, their properties and
  `bind:` on them.
