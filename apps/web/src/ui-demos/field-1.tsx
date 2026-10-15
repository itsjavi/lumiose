// Generated from packages/ui/docs/field.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Field } from "@lumiose/ui";

export function EmailField() {
  return (
    <form method="post">
      <Field.Root name="email" validationMode="onBlur" class="lu-field">
        <Field.Label>Email</Field.Label>
        <Field.Control type="email" required autocomplete="email" class="lu-input" />
        <Field.Description>We never share it.</Field.Description>
        <Field.Error match="valueMissing">Enter your email.</Field.Error>
        <Field.Error match="typeMismatch">Enter an email like ada@example.com.</Field.Error>
      </Field.Root>
      <button class="lu-button">Subscribe</button>
    </form>
  );
}
