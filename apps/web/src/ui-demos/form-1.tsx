// Generated from packages/ui/docs/form.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
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
