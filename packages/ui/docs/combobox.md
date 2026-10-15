# Combobox

> A text input that filters a list of options, for picking one value or several from many: the WAI-ARIA combobox pattern with list autocomplete, after Base UI's Combobox. The input shows the option's label and the form gets its value. `<lu-combobox>`, a 3.8 kB form-associated light-DOM element, runs it on server-rendered pages and in islands; `bind:value` and `bind:open` keep signals in sync. Groups, an empty state, a status, a clear button, multiple values with chips, validation and async options.

```ts
import { Combobox } from "@lumiose/ui"; // or "@lumiose/ui/combobox"
import "@lumiose/ui/combobox.css"; // places the popup and keeps filtered options hidden
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Combobox.Root>
  <Combobox.Label />
  <Combobox.Chips />
  <Combobox.Input />
  <Combobox.Clear />
  <Combobox.Trigger />
  <Combobox.Popup>
    <Combobox.List>
      <Combobox.Item />
      <Combobox.Group>
        <Combobox.GroupLabel />
        <Combobox.Item />
      </Combobox.Group>
    </Combobox.List>
    <Combobox.Empty />
    <Combobox.Status />
  </Combobox.Popup>
</Combobox.Root>
```

| Part         | Renders                                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Root`       | `<lu-combobox>`, a form control with no box (`display: contents`) that holds the value and runs the parts.                                      |
| `Label`      | `<label for="…">` for the input; it also names the listbox.                                                                                     |
| `Input`      | `<input type="text" role="combobox" aria-autocomplete="list" aria-expanded="…" aria-controls="…" autocomplete="off">`, the anchor of the popup. |
| `Trigger`    | `<button type="button" tabindex="-1" command="--toggle" commandfor="…">`, which opens and closes the popup.                                     |
| `Clear`      | `<button type="button" tabindex="-1" command="--clear" commandfor="…">`, hidden while there is nothing to clear.                                |
| `Chips`      | `<div role="list">` of the selected values, with `multiple`; the script renders a `<span role="listitem">` for each, with a remove `<button>`.  |
| `Popup`      | `<div popover="manual" data-side="…" data-align="…">` around the `List`, for an empty state or a status beside it. Optional.                    |
| `List`       | `<div role="listbox">` of options; the popover itself (`popover="manual"`, `data-side`, `data-align`) when there is no `Popup`.                 |
| `Item`       | `<div role="option" data-value="…" aria-selected="…">`.                                                                                         |
| `Group`      | `<div role="group">` of options, named by its `GroupLabel`, hidden while none of its options matches.                                           |
| `GroupLabel` | `<div role="presentation">`, which names its `Group`.                                                                                           |
| `Empty`      | `<div role="status" hidden>`, shown instead of the options when none matches the text. Inside a `Popup`.                                        |
| `Status`     | `<div role="status">` for a message whose changes are announced, such as "Searching…". Inside a `Popup`, or anywhere in the `Root`.             |

Every part goes inside `Root`. Options and groups go inside the `List`; the `Empty` and `Status`
parts go next to it in a `Popup`, never inside the listbox.

## API

### Combobox.Root

| Prop            | Type                                   | Default      |                                                                                                                             |
| --------------- | -------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `value`         | `string`, `string[]` with `multiple`   |              | Selects the option with this value (these values) when it changes. `""` or `[]` selects nothing.                            |
| `defaultValue`  | `string`, `string[]` with `multiple`   |              | The selection at first, when `value` is left out.                                                                           |
| `onValueChange` | `(value) => void`                      |              | Called after the user chooses, removes or clears a value, with the new value. Typing never calls it.                        |
| `bind:value`    | `Signal<string>`, `Signal<string[]>`   |              | Stands in for `value` and `onValueChange`.                                                                                  |
| `open`          | `boolean`                              |              | Opens or closes the popup when it changes, in the browser. Server HTML always starts closed.                                |
| `onOpenChange`  | `(open: boolean) => void`              |              | Called after the popup opens or closes, whatever did it.                                                                    |
| `bind:open`     | `Signal<boolean>`                      |              | Stands in for `open` and `onOpenChange`.                                                                                    |
| `multiple`      | `boolean`                              | `false`      | Several values: choosing an option toggles it and the popup stays open. `value` is then an array.                           |
| `name`          | `string`                               |              | The name the value is submitted under; with `multiple`, each value is its own entry.                                        |
| `required`      | `boolean`                              | `false`      | The form needs a value: the browser reports an empty combobox at its input on submit.                                       |
| `disabled`      | `boolean`                              | `false`      | The input and the buttons are disabled. A disabled `<fieldset>` around it does the same.                                    |
| `filter`        | `"contains" \| "startsWith" \| "none"` | `"contains"` | How typing filters the options by their label, ignoring case and accents. `"none"` leaves filtering to you (async options). |

Without `value`, `onValueChange` or `bind:value` the combobox keeps its own state. `Root` passes
`class`, `style` and other element props to `<lu-combobox>`.

### Combobox.Item

| Prop       | Type      | Default |                                                                                        |
| ---------- | --------- | ------- | -------------------------------------------------------------------------------------- |
| `value`    | `string`  |         | Required: the value the combobox takes, and submits, when the option is chosen.        |
| `label`    | `string`  |         | The text the input shows and typing matches, when the option's text content is not it. |
| `disabled` | `boolean` | `false` | The option cannot be chosen, and the arrow keys skip it (`aria-disabled`).             |

### Combobox.List and Combobox.Popup

| Prop          | Type                                                                       | Default    |                                                                    |
| ------------- | -------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------ |
| `side`        | `"top" \| "bottom" \| "left" \| "right" \| "inline-start" \| "inline-end"` | `"bottom"` | The input's side the popup goes on. It flips when it does not fit. |
| `align`       | `"start" \| "center" \| "end"`                                             | `"start"`  | How the popup aligns with the input along that side.               |
| `sideOffset`  | `number`                                                                   |            | The gap between the input and the popup, in CSS pixels.            |
| `alignOffset` | `number`                                                                   |            | A shift along the side, away from the aligned edge, in CSS pixels. |

The placement props go on the part that is the popover: the `Popup` when there is one, else the
`List`.

### Combobox.Chips

| Prop          | Type     | Default    |                                                                      |
| ------------- | -------- | ---------- | -------------------------------------------------------------------- |
| `removeLabel` | `string` | `"Remove"` | The remove buttons' name, before the value's label: "Remove Berlin". |

### The other parts

Each part takes the props of the element it renders (`class`, `style`, `aria-*`, `data-*`, event
handlers, `ref`) and passes them through. Your props override the defaults (`tabindex`,
`autocomplete`, `hidden`); the roles, ids, ARIA references, commands and the anchor stay the parts'
own, since they connect the parts.

- **`Input`**: `placeholder`, `onInput` (for async options) and `aria-describedby` pass through.
  Its `type` and `value` are the combobox's.
- **`Trigger`** and **`Clear`**: out of the tab order, as in the APG examples; the input does
  everything from the keyboard. Name them with `aria-label` (or content).
- **`Group`**: `aria-labelledby` points at its `GroupLabel` while one renders.

**Differences from Base UI's Combobox.** No `Portal`, `Positioner`, `Backdrop`, `Arrow`, `Value`,
`Icon`, `ItemIndicator`, `Row`, `Collection` or `Separator`: the top layer and anchor positioning
replace the first ones, and the theme draws the selected mark from `[aria-selected="true"]`. The
options are markup, not an `items` array, and filtering compares their labels; `filter="none"`
hands it to you, as Base UI's `filter={null}`. The chips are rendered by the script from the
selected options' labels rather than by your components, so a server-rendered page needs no island
for them. `Label` is a part of its own (Base UI uses `Field.Label`). Arrow keys skip disabled
options, as in Zag.

## Example

A city picker in a server-rendered page, with no island, in a form:

```tsx check
import { Combobox } from "@lumiose/ui";

const CITIES = [
  { value: "ber", label: "Berlin" },
  { value: "lis", label: "Lisbon" },
  { value: "mad", label: "Madrid" },
];

export function CityField() {
  return (
    <form method="post">
      <Combobox.Root name="city" defaultValue="lis" required class="lu-combobox">
        <Combobox.Label>City</Combobox.Label>
        <Combobox.Input placeholder="Search cities" />
        <Combobox.Clear aria-label="Clear city" />
        <Combobox.Trigger aria-label="Show cities" />
        <Combobox.Popup>
          <Combobox.List>
            {CITIES.map((city) => (
              <Combobox.Item value={city.value}>{city.label}</Combobox.Item>
            ))}
          </Combobox.List>
          <Combobox.Empty>No city matches.</Combobox.Empty>
        </Combobox.Popup>
      </Combobox.Root>
      <button class="lu-button">Save</button>
    </form>
  );
}
```

In an island: several values bound to a signal, and options loaded as the user types.
`bind:value={tags}` is short for `value={tags()}` plus `onValueChange={(next) => tags.set(next)}`.

```tsx check
import { Combobox } from "@lumiose/ui";
import { signal } from "lumiose";

const TAGS = ["accessibility", "bug", "docs", "performance", "security", "ui"];

/** Stands in for a request to your API: the tags that contain `text`, a moment later. */
function searchTags(text: string): Promise<string[]> {
  const query = text.trim().toLowerCase();
  const found = query ? TAGS.filter((tag) => tag.includes(query)) : [];
  return new Promise((resolve) => setTimeout(() => resolve(found), 200));
}

export function TagPicker() {
  const tags = signal<string[]>([]);
  const results = signal<string[]>([]);
  const searching = signal(false);
  const search = async (text: string) => {
    searching.set(true);
    results.set(await searchTags(text));
    searching.set(false);
  };
  return (
    <Combobox.Root multiple name="tags" filter="none" bind:value={tags} class="lu-combobox">
      <Combobox.Label>Tags</Combobox.Label>
      <Combobox.Chips />
      <Combobox.Input
        onInput={(event) => search((event.currentTarget as HTMLInputElement).value)}
      />
      <Combobox.Popup>
        <Combobox.List>
          {results().map((tag) => (
            <Combobox.Item value={tag}>{tag}</Combobox.Item>
          ))}
        </Combobox.List>
        <Combobox.Status>{searching() ? "Searching…" : ""}</Combobox.Status>
      </Combobox.Popup>
    </Combobox.Root>
  );
}
```

With `filter="none"`, the script gives new options the selection and opens the popup when results
arrive while the user types; a chosen value keeps its label after its option is gone.

## Styling

**With the default theme**, put `lu-combobox` on `Root`. It turns the root into the field's grid
(the label, the chips, then the input with the trigger and clear buttons over its inline end, with
a glyph when they are empty), and styles the popup, the options (highlighted, selected with a ✓,
disabled), the group labels, the chips and the empty and status messages. Its colours come from the
theme's `--lu-` properties ([UI components](README.md#the-default-theme)), and it sets a 4px gap
with `--lu-side-offset`.

**With your own CSS**, style the parts through `class` and their state:

- the input: `[aria-expanded="true"]` while the popup is open, `[aria-invalid="true"]` after a
  submit found it empty, `:disabled`;
- the popup: `:popover-open`, `data-side` and `data-align`;
- options: `[data-highlighted]` on the active option (by keyboard or pointer; focus stays in the
  input), `[aria-selected="true"]`, `[aria-disabled="true"]`;
- `[role="group"]`, a group label's `[role="presentation"]`, `[role="status"]`;
- chips: `[role="listitem"]` in the `Chips` list, and its `button`;
- the buttons: `[command="--toggle"]`, `[command="--clear"]` (`[hidden]` while there is nothing to
  clear);
- the element: `lu-combobox:disabled`, `:invalid` and `:user-invalid` (it is a form control).

A starting point:

```css
.combobox [role="listbox"] {
  max-block-size: 18rem;
  overflow-y: auto;
  padding: 0.25rem;
  border: 1px solid #d4d4d8;
  border-radius: 0.5rem;
  --lu-side-offset: 4px;
}
.combobox [role="option"] {
  padding: 0.375rem 0.5rem;
  border-radius: 0.25rem;
}
.combobox [role="option"][data-highlighted] {
  background: #f4f4f5;
  outline: 2px solid #2563eb;
  outline-offset: -2px;
}
.combobox [role="option"][aria-selected="true"]::before {
  content: "✓" / "";
}
```

`@lumiose/ui/combobox.css` holds what the combobox needs to work, in the `lu.core` layer:
`lu-combobox` has no box, the options, groups and empty state the script hides stay hidden whatever
`display` your CSS gives them, and the shared placement rules anchor the popup to the input (with
CSS anchor positioning, a popup sits on its `data-side` and `data-align`, keeps the gaps of
`--lu-side-offset` and `--lu-align-offset`, and flips when it does not fit).

## Keyboard and focus

The [WAI-ARIA combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) with a listbox
popup, list autocomplete and manual selection, with Base UI's behaviour where it leaves a choice.
Focus stays in the input; the active option is `aria-activedescendant`.

| Key                  | Does                                                                                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A character          | Edits the text, filters the options and opens the popup when something matches (or there is an `Empty`). Never commits.                                                                             |
| Arrow Down, Arrow Up | Closed: opens the popup on the selected option, else the first (Arrow Up: the last). Open: the next or previous option, past the last back to the input, then around. Disabled options are skipped. |
| Alt+Arrow Down       | Opens the popup without highlighting an option.                                                                                                                                                     |
| Alt+Arrow Up         | Closes the popup.                                                                                                                                                                                   |
| Enter                | Chooses the highlighted option. With nothing highlighted, it does what Enter does in a form field.                                                                                                  |
| Escape               | Closes the popup without choosing and puts the selection's label back. Closed, it goes on to the page, so a dialog closes.                                                                          |
| Tab                  | Closes the popup without choosing and moves on.                                                                                                                                                     |
| Backspace            | With `multiple`, in an empty input: removes the last value.                                                                                                                                         |
| Home, End            | Move the text cursor, as in any text field.                                                                                                                                                         |

- **Choosing** an option puts its label in the input and closes the popup, or, with `multiple`,
  toggles it, clears the text and keeps the popup open. It fires `change` once per change.
- **Emptying the input** clears a single selection. Closing the popup without choosing (Escape,
  Tab, a click outside) puts the label back.
- **The pointer**: a click on the input opens the popup, hovering highlights an option, a click
  chooses it; presses in the popup and on the buttons keep focus in the input. A click outside
  closes the popup; a right-click or a second finger outside leaves it open, as in Base UI.
- **IME**: while composing, Enter and the arrows belong to the input method.

## Without JavaScript, and the element's script

The combobox needs its script: there is no native element that filters a styled list (`<datalist>`
cannot be styled or grouped, and customizable select cannot filter). Without JavaScript the server
HTML shows a labelled text field and nothing opens, and the form gets no value. For a choice that
must work without JavaScript, use [Select](select.md).

A page that renders a `Combobox` loads the script once, as a 3.8 kB (brotli) module without the
Lumiose runtime, and islands bundle it. It defines `lu-combobox`, which upgrades every combobox on
the page in place: it reads the selection the server rendered (`aria-selected="true"`), puts its
label in the input, renders the chips, and from then on owns the value, the filtering, the popup,
the keyboard and the form value. Its popup is a manual popover, dismissed by the model Menu and
Popover share: an outside press with the main button, a close request (Escape, the Android back
gesture), Tab, or focus moving elsewhere.

The element is also an API of its own, for scripts and other frameworks:

- `value`: the selected option's `data-value` (`""` for none), or an array with `multiple`;
  setting it selects without a `change` event.
- `open`: a property; setting it opens or closes the popup.
- `name`, `required`, `disabled`, `multiple`: reflect their attributes; `filter` is an attribute.
- `form`, `validity`, `validationMessage`, `willValidate`, `checkValidity()`, `reportValidity()`:
  as on native controls. It submits under `name`, resets with its form and follows a disabled
  `<fieldset>`.
- `change`: a bubbling event after the user chooses, removes or clears a value. The inner input's
  own `change` stays inside.
- `openchange`: an event (not bubbling, like `toggle`) with `detail.open`, after the popup opens or
  closes.
- The buttons are invoker commands: a `<button commandfor="<the element's id>" command="--toggle">`
  (or `"--clear"`) works anywhere on the page; where the browser lacks invoker commands, the
  element handles the clicks of those inside it.

## Browser support

- **Form-associated custom elements** (`ElementInternals`): Chrome and Edge 77, Firefox 98,
  Safari 16.4.
- **Popovers**: Chrome and Edge 114, Firefox 125, Safari 17. **`showPopover({ source })`**: Chrome
  137, Firefox 144, Safari 26; older browsers open the popup the same way.
- **CSS anchor positioning** places the popup: Chrome and Edge 125, Firefox 147, Safari 26 (partly;
  27 fully). Elsewhere the script places it with the same sides, alignment, offsets and flips.
- **Invoker commands**: Chrome 135, Firefox 144, Safari 26.2; elsewhere the element handles the
  buttons' clicks.
- **`CloseWatcher`**, for the Android back gesture: Chrome 126, Firefox 149. Elsewhere Escape still
  closes the popup.

## Related

- [Select](select.md): a native select, when the user picks from a short list without typing; it
  works without JavaScript.
- [Menu](menu.md): commands rather than values, and the dismissal model the combobox shares.
- [UI components](README.md): the approach, styling, the default theme and the other components.
- [Islands](https://itsjavi.com/lumiose/docs/concepts/islands/): running a component in the
  browser, for `bind:value`, `bind:open` and async options.
- [JSX](https://itsjavi.com/lumiose/docs/concepts/jsx/): `bind:`, native events with `on:` and
  `ref`.
