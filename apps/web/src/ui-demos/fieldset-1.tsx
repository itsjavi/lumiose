// Generated from packages/ui/docs/fieldset.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Field, Fieldset } from "@lumiose/ui";

export function AddressFields() {
  return (
    <Fieldset.Root class="lu-fieldset">
      <Fieldset.Legend>Shipping address</Fieldset.Legend>
      <Field.Root name="street" class="lu-field">
        <Field.Label>Street</Field.Label>
        <Field.Control autocomplete="street-address" class="lu-input" />
      </Field.Root>
      <Field.Root name="city" class="lu-field">
        <Field.Label>City</Field.Label>
        <Field.Control autocomplete="address-level2" class="lu-input" />
      </Field.Root>
    </Fieldset.Root>
  );
}
