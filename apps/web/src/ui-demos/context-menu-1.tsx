// Generated from packages/ui/docs/context-menu.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { ContextMenu } from "@lumiose/ui";

export function FileActions() {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger class="file" tabindex={0} aria-label="report.pdf">
        report.pdf
      </ContextMenu.Trigger>
      <ContextMenu.Popup class="lu-menu" aria-label="File actions">
        <ContextMenu.Item>Rename</ContextMenu.Item>
        <ContextMenu.Item>Duplicate</ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.SubmenuRoot>
          <ContextMenu.SubmenuTrigger>Move to</ContextMenu.SubmenuTrigger>
          <ContextMenu.Popup class="lu-menu">
            <ContextMenu.Item>Archive</ContextMenu.Item>
            <ContextMenu.Item>Trash</ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.SubmenuRoot>
      </ContextMenu.Popup>
    </ContextMenu.Root>
  );
}
