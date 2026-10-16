// Generated from packages/ui/docs/number-field.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { NumberField } from "@lumiose/ui";
import { signal } from "lumiose";

export function PriceField() {
  const price = signal<number | null>(19.9);
  return (
    <NumberField.Root
      id="price"
      name="price"
      bind:value={price}
      min={0}
      step={0.5}
      format={{ style: "currency", currency: "EUR" }}
      class="lu-number-field"
    >
      <NumberField.ScrubArea>
        <label for="price">Price</label>
      </NumberField.ScrubArea>
      <NumberField.Group>
        <NumberField.Decrement aria-label="Lower the price">−</NumberField.Decrement>
        <NumberField.Input />
        <NumberField.Increment aria-label="Raise the price">+</NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  );
}
