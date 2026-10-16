// Generated from packages/ui/docs/popover.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Popover } from "@lumiose/ui";

export function HoverAndModal() {
  return (
    <>
      <Popover.Root>
        <Popover.Trigger class="lu-button" openOnHover delay={200}>
          Ada Lovelace
        </Popover.Trigger>
        <Popover.Popup class="lu-popover" sideOffset={8}>
          <Popover.Title>Ada Lovelace</Popover.Title>
          <Popover.Description>Wrote the first published program.</Popover.Description>
        </Popover.Popup>
      </Popover.Root>
      <Popover.Root modal>
        <Popover.Trigger class="lu-button">Rename</Popover.Trigger>
        <Popover.Popup class="lu-popover" align="start" sideOffset={8}>
          <Popover.Title>Rename the file</Popover.Title>
          <label>
            Name <input class="lu-input" value="report.pdf" />
          </label>
          <footer>
            <Popover.Close class="lu-button">Done</Popover.Close>
          </footer>
        </Popover.Popup>
      </Popover.Root>
    </>
  );
}
