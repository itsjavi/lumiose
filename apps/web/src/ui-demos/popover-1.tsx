// Generated from packages/ui/docs/popover.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Popover } from "@lumiose/ui";

export function Notifications() {
  return (
    <Popover.Root>
      <Popover.Trigger class="lu-button">Notifications</Popover.Trigger>
      <Popover.Popup class="lu-popover" align="start">
        <Popover.Title>Notifications</Popover.Title>
        <Popover.Description>You are all caught up.</Popover.Description>
        <footer>
          <Popover.Close class="lu-button">Close</Popover.Close>
        </footer>
      </Popover.Popup>
    </Popover.Root>
  );
}
