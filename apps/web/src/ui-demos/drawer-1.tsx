// Generated from packages/ui/docs/drawer.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Drawer } from "@lumiose/ui";

export function FiltersSheet() {
  return (
    <Drawer.Root>
      <Drawer.Trigger class="lu-button">Filters</Drawer.Trigger>
      <Drawer.Popup class="lu-drawer">
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Description>Swipe down, or press Done, to close.</Drawer.Description>
        <footer>
          <Drawer.Close class="lu-button" data-variant="primary">
            Done
          </Drawer.Close>
        </footer>
      </Drawer.Popup>
    </Drawer.Root>
  );
}
