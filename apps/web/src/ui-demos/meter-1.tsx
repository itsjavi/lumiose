// Generated from packages/ui/docs/meter.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Meter } from "@lumiose/ui";

export function StorageMeter() {
  return (
    <Meter.Root
      value={7.2}
      max={10}
      getAriaValueText={(_, gb) => `${gb} of 10 GB`}
      class="lu-meter"
    >
      <Meter.Label>Storage used</Meter.Label>
      <Meter.Value>{(_, gb) => `${gb} GB of 10`}</Meter.Value>
      <Meter.Track low={6} high={9} optimum={0} />
    </Meter.Root>
  );
}
