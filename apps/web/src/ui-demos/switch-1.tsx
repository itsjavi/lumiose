// Generated from packages/ui/docs/switch.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Switch } from "@lumiose/ui";
import { signal } from "lumiose";

export function AirplaneMode() {
  const on = signal(false);
  return (
    <p>
      <label>
        <Switch.Root name="airplane" bind:checked={on} class="lu-switch" /> Airplane mode
      </label>{" "}
      {on() ? "Radios off." : ""}
    </p>
  );
}
