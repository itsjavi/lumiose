// Generated from packages/ui/docs/installation.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Popover } from "@lumiose/ui";

export function Help() {
  return (
    <Popover.Root>
      <Popover.Trigger class="lu-button">Help</Popover.Trigger>
      <Popover.Popup class="lu-popover">
        <Popover.Title>Help</Popover.Title>
        <Popover.Description>
          Server HTML: this popover opens without JavaScript.
        </Popover.Description>
      </Popover.Popup>
    </Popover.Root>
  );
}
