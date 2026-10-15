// Generated from packages/ui/docs/popover.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Popover } from "@lumiose/ui";
import { signal } from "lumiose";

export function Filters() {
  const open = signal(false);
  return (
    <>
      <Popover.Root bind:open={open}>
        <Popover.Trigger class="lu-button">Filters</Popover.Trigger>
        <Popover.Popup class="lu-popover" side="right" sideOffset={8}>
          <Popover.Title>Filters</Popover.Title>
        </Popover.Popup>
      </Popover.Root>
      <p>{open() ? "Choosing filters…" : "All items"}</p>
    </>
  );
}
