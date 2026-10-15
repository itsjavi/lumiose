// Generated from packages/ui/docs/slider.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Slider } from "@lumiose/ui";
import { signal } from "lumiose";

export function PriceRange() {
  const price = signal([20, 80]);
  return (
    <Slider.Root
      name="price"
      bind:value={price}
      minStepsBetweenValues={5}
      format={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
      class="lu-slider"
    >
      <Slider.Label>Price</Slider.Label>
      <Slider.Value />
      <Slider.Control>
        <Slider.Track>
          <Slider.Indicator />
        </Slider.Track>
        <Slider.Thumb aria-label="Minimum price" />
        <Slider.Thumb aria-label="Maximum price" />
      </Slider.Control>
    </Slider.Root>
  );
}
