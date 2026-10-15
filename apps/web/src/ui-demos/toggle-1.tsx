// Generated from packages/ui/docs/toggle.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Toggle } from "@lumiose/ui";
import { signal } from "lumiose";

export function PinToggle() {
  const pinned = signal(false);
  return (
    <p>
      <Toggle bind:pressed={pinned} class="lu-toggle">
        Pin
      </Toggle>{" "}
      {pinned() ? "Pinned to the top." : "Not pinned."}
    </p>
  );
}
