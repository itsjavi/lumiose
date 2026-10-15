// Generated from packages/ui/docs/radio-group.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Fieldset, Radio, RadioGroup } from "@lumiose/ui";
import { signal } from "lumiose";

export function ShippingChoice() {
  const speed = signal("standard");
  return (
    <div>
      <RadioGroup name="shipping" bind:value={speed} class="lu-fieldset">
        <Fieldset.Legend>Shipping</Fieldset.Legend>
        <label>
          <Radio.Root value="standard" class="lu-radio" /> Standard
        </label>
        <label>
          <Radio.Root value="express" class="lu-radio" /> Express
        </label>
        <label>
          <Radio.Root value="drone" disabled class="lu-radio" /> Drone (soon)
        </label>
      </RadioGroup>
      <p>Arrives {speed() === "express" ? "tomorrow" : "in three days"}.</p>
    </div>
  );
}
