# Form

> A native `<form>` that hands its fields the server's errors, after Base UI's Form. Pass the data a form action gives `fail()` as `errors`, and each [Field](field.md) shows the message for its `name`, in the HTML the server renders back (no JavaScript needed) or, with `submit()`, in an island. Submission, validation and the first invalid field's focus are the platform's and Field's.

```ts
import { Form } from "@lumiose/ui"; // or "@lumiose/ui/form"
```

## Anatomy

```tsx
<Form>
  <Field.Root />
</Form>
```

| Part   | Renders                               |
| ------ | ------------------------------------- |
| `Form` | `<form>`, with the props it is given. |

## API

### Form

| Prop             | Type                                                              | Default      |                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `errors`         | `object`                                                          |              | The server's errors by field name: a message or several for each `Field.Root` `name`, such as `actionData()` after a `fail()`.       |
| `validationMode` | `"onSubmit" \| "onBlur" \| "onChange"`                            | `"onSubmit"` | When the fields show their errors, unless a field sets its own.                                                                      |
| `values`         | `FormData`, `URLSearchParams` or `{ [name]: string \| string[] }` |              | The values to fill the controls with after a failed submission, by name, such as the `FormData` an action passes back with `fail()`. |

Every other `<form>` prop passes through: `method`, `action`, `onSubmit` (Lumiose's `submit`),
`novalidate`, `class`.

**`values`** replace the controls' defaults, by `name` (the control's, or its Field's): the text of
an Input (Field.Control), an Autocomplete, a Select, a Number Field or a Slider, the checked state of
a Checkbox or Switch (a name the submission left out means unchecked), and a Checkbox Group's,
Radio Group's or Combobox's selection. Controls with a `value` (or `bind:`) keep theirs, and
passwords, files, hidden inputs, OTP Fields and disabled controls (also in a disabled
`Fieldset.Root`) are never filled. So after a failed action the page renders the form as the user
left it, with JavaScript or without (WCAG 3.3.7, redundant entry).

**Differences from Base UI's Form.** No `onFormSubmit` or `actionsRef`: the form is native and
Lumiose's form actions post it (`action="?/name"`, `onSubmit={submit}`). Base UI sets
`noValidate`; here the browser's validation stays on, so it still works without JavaScript, and
Field's script shows the problems in the fields instead of the browser's bubble.

## Example

A sign-up page whose action checks the username on the server:

```tsx check
import { Field, Form } from "@lumiose/ui";
import { actionData, fail, type ActionContext } from "lumiose";

export const actions = {
  async signup(ctx: ActionContext) {
    const form = await ctx.formData();
    if (form.get("username") === "admin") {
      // The errors, and what the user typed: the form renders back filled in.
      return fail(400, { errors: { username: "That username is taken." }, values: form });
    }
    return { welcome: String(form.get("username")) };
  },
};

export function SignupForm() {
  const result = actionData<typeof actions>();
  const failed = result && "errors" in result ? result : undefined;
  return (
    <Form method="post" action="?/signup" errors={failed?.errors} values={failed?.values}>
      <Field.Root name="username" class="lu-field">
        <Field.Label>Username</Field.Label>
        <Field.Control required minlength={3} autocomplete="username" class="lu-input" />
        <Field.Error />
      </Field.Root>
      <button class="lu-button" data-variant="primary">
        Sign up
      </button>
    </Form>
  );
}
```

Only the keys of `errors` that name a field and hold a string or an array of strings become
errors, so `errors={result}` also works for an action that fails with the errors alone. The
submitted `FormData` reaches the browser with the page (its text entries; files are left out):
delete secrets such as a password from it before `fail()`. In an island, add `onSubmit={submit}`
and the errors arrive without a page load; the controls keep what the user typed anyway.

## Styling

Form adds nothing to style: style the `form` and its state, `form:invalid` (a field is invalid)
and `form:has(:user-invalid)` (one the user touched is), and its fields
([Field](field.md#styling)). Form ships no stylesheet.

## Keyboard and focus

The platform's: Enter in a text field submits the form. On a submit attempt with invalid fields,
nothing is sent, the fields show their errors, and the first invalid control takes focus (Field's
script; without it, the browser focuses it and shows its bubble).

## Without JavaScript

A native form posts to its action and the page renders back with `actionData()`, so the server's
errors show in their fields with no script, and with `values` the controls show what was
submitted. The browser validates the fields before it posts.

## Browser support

Every browser. Field's script needs the `invalid` event and constraint validation, which every
supported browser has.

## Related

- [Field](field.md): the fields and their errors.
- [Fieldset](fieldset.md): groups of fields.
- [Data and actions](https://itsjavi.com/lumiose/docs/concepts/data-and-actions/): form actions,
  `fail()`, `actionData()` and `submit()`.
