// Generated from packages/ui/docs/drawer.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Drawer } from "@lumiose/ui";
import { signal } from "lumiose";

export function NavigationDrawer() {
  const open = signal(false);
  return (
    <>
      <button type="button" class="lu-button" onClick={() => open.set(true)}>
        Menu
      </button>
      <Drawer.Root bind:open={open} swipeDirection="left">
        <Drawer.Popup class="lu-drawer">
          <Drawer.Title>Menu</Drawer.Title>
          <Drawer.Description>Swipe left to close.</Drawer.Description>
          <Drawer.Close class="lu-button">Close</Drawer.Close>
        </Drawer.Popup>
      </Drawer.Root>
      <p>{open() ? "The menu is open" : "The menu is closed"}</p>
    </>
  );
}
