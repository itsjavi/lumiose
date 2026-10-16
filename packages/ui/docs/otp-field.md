# OTP Field

> A one-time code input, after Base UI's OTPField: one native `<input>` shown as one slot per character. SMS autofill (`autocomplete="one-time-code"`), paste, Backspace, the arrow keys, `maxlength`, `pattern`, `required` and the form's value are the platform's, without JavaScript too, and assistive technology meets one labelled text field. `<lu-otp-field>`'s 1.3 kB script lays the input over the slots, keeps the code to the allowed characters, and reports completion. `bind:value` keeps a signal in sync.

```ts
import { OTPField } from "@lumiose/ui"; // or "@lumiose/ui/otp-field"
import "@lumiose/ui/otp-field.css"; // or "@lumiose/ui/styles.css" for every component
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<OTPField.Root length={6}>
  <OTPField.Input />
  <OTPField.Slot />
  <OTPField.Slot />
  <OTPField.Separator />
  <OTPField.Slot />
</OTPField.Root>
```

| Part        | Renders                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Root`      | `<lu-otp-field length validation-type>`, with `data-complete`, `data-filled` and `data-focused` from its script         |
| `Input`     | `<input type="text" autocomplete="one-time-code" inputmode maxlength minlength pattern name>`: the field and its value  |
| `Slot`      | `<div aria-hidden="true" data-slot>`: the next character (a dot with `mask`), `data-filled`, `data-active` at the caret |
| `Separator` | `<div aria-hidden="true" data-orientation>`: a dash or a gap between slots                                              |

Name the field with a [Field](field.md) (`Field.Label`), a `<label for>` the Root's `id`, or an
`aria-label` on the `Input`.

## API

### OTPField.Root

| Prop                               | Type                                               | Default           |                                                                                     |
| ---------------------------------- | -------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------- |
| `length`                           | `number`                                           |                   | How many characters the code has. Required.                                         |
| `value`                            | `string`                                           |                   | Shows this code when it changes. Pair it with `onValueChange`.                      |
| `defaultValue`                     | `string`                                           | `""`              | The code at first; a form reset goes back to it.                                    |
| `onValueChange`                    | `(value: string) => void`                          |                   | Called as the code changes: typing, a paste, autofill, Backspace.                   |
| `bind:value`                       | `Signal<string>`                                   |                   | Stands in for `value` and `onValueChange`.                                          |
| `onValueComplete`                  | `(value: string) => void`                          |                   | Called when the last character is entered.                                          |
| `onValueInvalid`                   | `(value: string) => void`                          |                   | Called with what was entered when it held characters the field does not allow.      |
| `validationType`                   | `"numeric" \| "alpha" \| "alphanumeric" \| "none"` | `"numeric"`       | The characters the code may hold; spaces are always dropped.                        |
| `normalizeValue`                   | `(value: string) => string`                        |                   | Normalizes what is entered before the allowed characters are kept (an island).      |
| `inputMode`                        | `"numeric" \| "text" \| "tel" \| "none"`           | from the type     | The virtual keyboard: numeric for digits, text otherwise.                           |
| `mask`                             | `boolean`                                          | `false`           | The slots show dots.                                                                |
| `autoComplete`                     | `string`                                           | `"one-time-code"` | The input's `autocomplete`.                                                         |
| `autoSubmit`                       | `boolean`                                          | `false`           | Submits the form when the last character is entered.                                |
| `name`, `form`                     | `string`                                           |                   | The name the code is submitted under, and the id of its form when it is outside it. |
| `id`                               | `string`                                           | generated         | The input's id, for a `<label for>`.                                                |
| `required`, `disabled`, `readOnly` | `boolean`                                          | `false`           | As on a native input.                                                               |

### The other parts

`Input` takes `<input>` props except the code's own (`type`, `value`, `name`, `maxlength`,
`pattern`, `inputmode`, `autocomplete`, …: the Root's); `placeholder` and `aria-label` pass
through. `Slot` and `Separator` take `<div>` props. Inside a [Field](field.md), the input takes the
field's id, name, description and error.

**One input, not one per character.** Base UI renders an input per slot. Here one input holds the
code: autofill of an SMS code works natively (it fills one field), a paste or Backspace needs no
script, the browser validates the whole code (`pattern`, `minlength`) and submits it, and a screen
reader meets one field named once instead of six. The slots are a picture of that input, drawn by
the script; the input lies over them, transparent, so a press on a slot moves the caret there.

**Differences from Base UI's OTPField.** `Slot` replaces the per-character `Input`s; the
`Separator` is visual (`aria-hidden`). `normalizeValue` (`(text) => text.toUpperCase()`, say)
works in an island, where Root hands it to the element: a server page's script cannot receive a
function. No `inputRef`, no `render`.

## Example

```tsx check
import { OTPField } from "@lumiose/ui";
import { signal } from "lumiose";

export function VerifyCode() {
  const code = signal("");
  return (
    <form method="post">
      <label for="code">Verification code</label>
      <OTPField.Root
        id="code"
        name="code"
        length={6}
        required
        bind:value={code}
        class="lu-otp-field"
      >
        <OTPField.Input />
        <OTPField.Slot />
        <OTPField.Slot />
        <OTPField.Slot />
        <OTPField.Separator />
        <OTPField.Slot />
        <OTPField.Slot />
        <OTPField.Slot />
      </OTPField.Root>
      <button type="submit" class="lu-button" disabled={code().length < 6}>
        Verify
      </button>
    </form>
  );
}
```

## Styling

**With the default theme**, put `lu-otp-field` on `Root`: a 2.5rem box per character (they shrink
on narrow screens), the caret's box ringed while the field has focus with a blinking caret in it
(still where motion is reduced), and a short dash for a separator.

**With your own CSS**, style the slots through `[data-slot]`, `[data-filled]` and `[data-active]`,
the separator through `[data-orientation]`, and the root through `[data-complete]`,
`[data-focused]` and `:has(input:disabled)`.

`@lumiose/ui/otp-field.css` (0.2 kB brotli) lays the input over the slots once the script runs
(`:defined`), its text, caret and selection transparent, and until then shows the input as a plain
field and hides the slots.

## Keyboard and focus

| Key                | Does                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| A character        | Fills the caret's slot; in a full field, types over it. Refused characters do nothing. |
| Backspace / Delete | Deletes the character before or after the caret, as in any text field.                 |
| Arrow Left / Right | Moves the caret, and the ringed slot, one slot.                                        |
| Home / End         | The first slot, or after the last character.                                           |
| Tab                | Moves on: one tab stop.                                                                |

A paste fills every slot from the caret, its spaces and dashes dropped, even past what
`maxlength` would cut. An IME composition (Chinese, Japanese, full-width digits) shows in the
slots as it is; only the committed text is kept to the allowed characters, completes the field and
auto-submits.

## Without JavaScript, and the element's script

The input is a native text field: autofill, typing, paste, `pattern` and `required` validation and
submission work with no script, and the slots stay hidden. `<lu-otp-field>`'s script (1.3 kB
brotli) shows the slots, cleans the value as it changes (firing `valueinvalid` for refused input),
fires `valuecomplete`, auto-submits, and follows a form reset.

A numeric code (`validationType="numeric"`, the default) renders `dir="ltr"` on the Root: its
slots run left to right in a right-to-left page too, as digits read there. Other codes follow the
page; pass `dir` to choose.

## Browser support

`autocomplete="one-time-code"`: Safari (iOS, macOS) and Chrome on Android offer received codes;
elsewhere the field is a plain one. `pattern` with `\p{…}` classes needs the `v` flag that every
current browser uses for `pattern`.

## Related

- [Field](field.md): a label, a description and errors for the code.
- [Input](input.md): a text field without slots.
- [Form](form.md): submitting the code to a form action.
