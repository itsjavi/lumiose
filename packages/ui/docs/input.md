# Input

> A native `<input>`, after Base UI's Input: every type, constraint and autofill the browser has, plus `onValueChange` and `bind:value`. Inside a [Field](field.md) (as `Field.Control`) it takes the field's id, name and ARIA references. No script, no CSS of its own.

```ts
import { Input } from "@lumiose/ui"; // or "@lumiose/ui/input"
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Input />
```

| Part    | Renders                                |
| ------- | -------------------------------------- |
| `Input` | `<input>`, with the props it is given. |

## API

### Input

| Prop            | Type                      | Default |                                                                             |
| --------------- | ------------------------- | ------- | --------------------------------------------------------------------------- |
| `value`         | `string`                  |         | Sets the value when it changes. Pair it with `onValueChange`.               |
| `defaultValue`  | `string`                  |         | The value at first, when `value` is left out; a form reset goes back to it. |
| `onValueChange` | `(value: string) => void` |         | Called with the new value on every edit.                                    |
| `bind:value`    | `Signal<string>`          |         | Stands in for `value` and `onValueChange`.                                  |

Every native `<input>` prop passes through: `type`, `name`, `required`, `pattern`, `minlength`,
`placeholder`, `autocomplete`, `readonly`, `disabled`, `class`, `aria-*`, events. Inside a Field,
its own `id`, `name`, `aria-describedby` and `aria-invalid` win over the field's.

**Differences from Base UI's Input.** The same element and props; `bind:value` stands in for the
pair.

## Example

A search box in an island, bound to a signal:

```tsx check
import { Input } from "@lumiose/ui";
import { signal } from "lumiose";

const BOOKS = ["Dune", "Emma", "Ulysses", "Middlemarch"];

export function BookSearch() {
  const query = signal("");
  const found = () => BOOKS.filter((book) => book.toLowerCase().includes(query().toLowerCase()));
  return (
    <search>
      <Input type="search" aria-label="Search books" bind:value={query} class="lu-input" />
      <p>{found().join(", ") || "No books."}</p>
    </search>
  );
}
```

## Styling

**With the default theme**, put `lu-input` on it: a bordered field, a muted placeholder, a focus
ring, a red border with `aria-invalid="true"`.

**With your own CSS**, style the `input` and its state: `:focus-visible`, `:disabled`,
`:read-only`, `:placeholder-shown`, `:user-invalid`, `[aria-invalid="true"]`.

Input ships no stylesheet: it needs none to work.

## Keyboard and focus

The browser's text-field keyboard. One tab stop.

## Without JavaScript

A native input: typing, autofill, validation and submission work with no script. `value`,
`onValueChange` and `bind:value` need the component to run in an island.

## Browser support

Every browser; input types and constraints as the browser supports them.

## Related

- [Field](field.md): label, description and errors for an Input (`Field.Control`).
- [Combobox](combobox.md): an input that filters options.
- [JSX](https://itsjavi.com/lumiose/docs/concepts/jsx/): `bind:value`.
