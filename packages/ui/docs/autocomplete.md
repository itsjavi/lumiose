# Autocomplete

> A text input with suggestions, for text that may be anything (a search, a tag, an address): the WAI-ARIA combobox pattern with list autocomplete, after Base UI's Autocomplete. Unlike a [Combobox](combobox.md), the text is the value: the input has the name and submits what is typed, and choosing a suggestion only fills it in. It runs on the Combobox's element (`<lu-combobox free>`, 5.0 kB) and parts, on server-rendered pages and in islands; `bind:value` keeps a signal in sync. Filtering, inline completion, groups, an empty state and a status.

```ts
import { Autocomplete } from "@lumiose/ui"; // or "@lumiose/ui/autocomplete"
import "@lumiose/ui/autocomplete.css"; // Combobox's CSS: places the popup, hides filtered options
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Autocomplete.Root>
  <Autocomplete.Label />
  <Autocomplete.Input />
  <Autocomplete.Clear />
  <Autocomplete.Trigger />
  <Autocomplete.Popup>
    <Autocomplete.List>
      <Autocomplete.Item />
      <Autocomplete.Group>
        <Autocomplete.GroupLabel />
        <Autocomplete.Item />
      </Autocomplete.Group>
    </Autocomplete.List>
    <Autocomplete.Empty />
    <Autocomplete.Status />
  </Autocomplete.Popup>
</Autocomplete.Root>
```

| Part                  | Renders                                                                             |
| --------------------- | ----------------------------------------------------------------------------------- |
| `Root`                | `<lu-combobox free>`: the element, with no box; `inline` with inline completion     |
| `Label`               | `<label for>` the input                                                             |
| `Input`               | `<input role="combobox" aria-autocomplete name value>`: the form control            |
| `Clear`, `Trigger`    | `<button tabindex="-1">`: empty the text, or open and close the suggestions         |
| `Popup`, `List`       | `<div popover>` around the `<div role="listbox">`, or the listbox as the popup      |
| `Item`                | `<div role="option" data-value>`: a suggestion; its `value` is the text it fills in |
| `Group`, `GroupLabel` | `<div role="group">` named by its `<div role="presentation">`                       |
| `Empty`, `Status`     | `<div role="status">`: shown when nothing matches, or a message you update          |

The parts are [Combobox](combobox.md)'s, under this Root: their props and styling hooks are the
same.

## API

### Autocomplete.Root

| Prop                                | Type                                     | Default      |                                                                                 |
| ----------------------------------- | ---------------------------------------- | ------------ | ------------------------------------------------------------------------------- |
| `value`                             | `string`                                 |              | Puts this text in the input when it changes. Pair it with `onValueChange`.      |
| `defaultValue`                      | `string`                                 |              | The text at first; a form reset goes back to it.                                |
| `onValueChange`                     | `(value: string) => void`                |              | Called as the text changes: typing, choosing a suggestion, clearing.            |
| `bind:value`                        | `Signal<string>`                         |              | Stands in for `value` and `onValueChange`.                                      |
| `open`, `onOpenChange`, `bind:open` | `boolean`, `(open: boolean) => void`     |              | Open or close the suggestions, and hear about it, as in Combobox.               |
| `mode`                              | `"list" \| "both" \| "inline" \| "none"` | `"list"`     | How the suggestions complete the text (below).                                  |
| `filter`                            | `"contains" \| "startsWith"`             | `"contains"` | How `"list"` and `"both"` filter the suggestions, ignoring case and accents.    |
| `openOnInputClick`                  | `boolean`                                | `false`      | A click on the input opens the suggestions; otherwise typing and Arrow Down do. |
| `autoHighlight`                     | `boolean`                                | `false`      | The first suggestion is highlighted as you type, so Enter fills it in.          |
| `keepHighlight`                     | `boolean`                                | `false`      | A suggestion the pointer highlighted stays highlighted when it leaves the list. |
| `submitOnItemClick`                 | `boolean`                                | `false`      | A click on a suggestion fills it in and submits the form, as a search box does. |
| `limit`                             | `number`                                 | no limit     | Shows at most this many suggestions; a narrower text shows the others.          |
| `name`                              | `string`                                 |              | The name the text is submitted under (the input's).                             |
| `required`, `disabled`              | `boolean`                                | `false`      | As on a native input.                                                           |

The modes follow Base UI's:

- **`"list"`**: typing filters the suggestions; the input keeps what is typed while the arrows move
  through them.
- **`"both"`**: filtered, and the arrows show the highlighted suggestion in the input, its
  completed part selected; Escape takes it back, Tab or a click elsewhere keeps it.
- **`"inline"`**: the arrows show the highlighted suggestion in the input, unfiltered.
- **`"none"`**: neither: the page filters the suggestions itself (results from a server).

### The other parts

As in [Combobox](combobox.md#the-other-parts). An `Item`'s `value` is the text it fills in (and its
`label`, when the shown text differs, what typing matches). Inside a [Field](field.md), the input
takes the field's id, name, description and error, and the field shows its validation.

**Differences from Base UI's Autocomplete.** The suggestions are markup, not an `items` array, and
filtering compares their text (`mode="none"` hands it to you, as Base UI's `filter={null}`).
`limit` hides the matches past it, as filtering does, so it applies to the server's suggestions
too. No `Portal`, `Positioner`,
`Backdrop`, `Arrow`, `Value`, `Icon`, `Row`, `Collection` or `Separator`.

## Example

A search with suggestions, in an island:

```tsx check
import { Autocomplete } from "@lumiose/ui";
import { signal } from "lumiose";

const TOPICS = ["accessibility", "animation", "forms", "islands", "routing", "signals"];

export function TopicSearch() {
  const query = signal("");
  return (
    <>
      <Autocomplete.Root name="q" bind:value={query} class="lu-combobox">
        <Autocomplete.Label>Search the docs</Autocomplete.Label>
        <Autocomplete.Input placeholder="Any topic" />
        <Autocomplete.Popup>
          <Autocomplete.List>
            {TOPICS.map((topic) => (
              <Autocomplete.Item value={topic}>{topic}</Autocomplete.Item>
            ))}
          </Autocomplete.List>
          <Autocomplete.Empty>No suggestions: press Enter to search.</Autocomplete.Empty>
        </Autocomplete.Popup>
      </Autocomplete.Root>
      <p>{query() ? `Searching for “${query()}”` : "Type to search."}</p>
    </>
  );
}
```

## Styling

**With the default theme**, put `lu-combobox` on `Root`, as for a Combobox: the label, the input
with its buttons, and the popup with the highlighted suggestion marked.

**With your own CSS**, style the parts through `class` and their state: `[aria-expanded]` on the
input, `:popover-open` on the popup, `[data-highlighted]` and `[aria-disabled]` on the
suggestions, `[hidden]` on filtered ones.

`@lumiose/ui/autocomplete.css` is Combobox's stylesheet: it places the popup next to the input and
keeps filtered suggestions hidden.

## Keyboard and focus

| Key                   | Does                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Typing                | Filters the suggestions (with `"list"` and `"both"`) and opens them; an empty input closes them. |
| Arrow Down / Arrow Up | Opens the suggestions, then moves the highlight (with `"both"` and `"inline"`, into the input).  |
| Enter                 | Fills in the highlighted suggestion (the first, with `autoHighlight`); with none, submits.       |
| Escape                | Closes the suggestions and keeps the typed text (taking back an inline completion).              |
| Tab                   | Closes the suggestions and moves on, keeping the text.                                           |

Focus stays in the input: the highlight moves through `aria-activedescendant`.

## Without JavaScript, and the element's script

The input is a native text field with the name: typing, `required`, submission and reset work with
no script; the suggestions need it. `<lu-combobox>`'s script (5.0 kB brotli, shared with Combobox)
filters and opens them, moves the highlight, fills in a choice (firing `input` and `change` on the
input) and runs inline completion.

## Browser support

As [Combobox](combobox.md#browser-support): popover, and CSS anchor positioning where available
(the script places the popup elsewhere).

## Related

- [Combobox](combobox.md): a value picked from the options, when the text must match one.
- [Field](field.md): a label, a description and errors for an autocomplete.
- [Input](input.md): a text field without suggestions.
