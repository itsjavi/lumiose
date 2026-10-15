// Generated from packages/ui/docs/form.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
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
