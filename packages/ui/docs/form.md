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

| Prop             | Type                                   | Default      |                                                                                                                                |
| ---------------- | -------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `errors`         | `object`                               |              | The server's errors by field name: a message or several for each `Field.Root` `name`, such as `actionData()` after a `fail()`. |
| `validationMode` | `"onSubmit" \| "onBlur" \| "onChange"` | `"onSubmit"` | When the fields show their errors, unless a field sets its own.                                                                |

Every other `<form>` prop passes through: `method`, `action`, `onSubmit` (Lumiose's `submit`),
`novalidate`, `class`.

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
      return fail(400, { username: "That username is taken." });
    }
    return { welcome: String(form.get("username")) };
  },
};

export function SignupForm() {
  const result = actionData<typeof actions>();
  return (
    <Form method="post" action="?/signup" errors={result}>
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

`errors={result}` works whatever else the action returns: only the keys that name a field and hold
a string or an array of strings become errors. In an island, add `onSubmit={submit}` and the
errors arrive without a page load.

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
errors show in their fields with no script. The browser validates the fields before it posts.

## Browser support

Every browser. Field's script needs the `invalid` event and constraint validation, which every
supported browser has.

## Related

- [Field](field.md): the fields and their errors.
- [Fieldset](fieldset.md): groups of fields.
- [Data and actions](https://itsjavi.com/lumiose/docs/concepts/data-and-actions/): form actions,
  `fail()`, `actionData()` and `submit()`.
