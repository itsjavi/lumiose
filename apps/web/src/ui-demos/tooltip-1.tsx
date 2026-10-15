// Generated from packages/ui/docs/tooltip.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Tooltip } from "@lumiose/ui";

export function BoldButton() {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger class="lu-button" aria-label="Bold">
        B
      </Tooltip.Trigger>
      <Tooltip.Popup class="lu-tooltip">Bold (Ctrl+B)</Tooltip.Popup>
    </Tooltip.Root>
  );
}
