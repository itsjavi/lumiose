// Generated from packages/ui/docs/checkbox-group.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Checkbox, CheckboxGroup, Fieldset } from "@lumiose/ui";

const TOPPINGS = ["Cheese", "Olives", "Peppers"];

export function ToppingsGroup() {
  return (
    <CheckboxGroup
      name="toppings"
      defaultValue={["Cheese"]}
      allValues={TOPPINGS}
      class="lu-fieldset"
    >
      <Fieldset.Legend>Toppings</Fieldset.Legend>
      <label>
        <Checkbox.Root parent class="lu-checkbox" /> All toppings
      </label>
      {TOPPINGS.map((topping) => (
        <label>
          <Checkbox.Root value={topping} class="lu-checkbox" /> {topping}
        </label>
      ))}
    </CheckboxGroup>
  );
}
