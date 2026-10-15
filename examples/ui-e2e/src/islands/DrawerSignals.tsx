import { Drawer } from "@lumiose/ui";
import { signal } from "lumiose";

/** A Drawer bound to a signal with bind:open (TASK-382). */
export function DrawerSignals() {
  const open = signal(false);
  return (
    <section>
      <button type="button" class="lu-button" data-testid="open" onClick={() => open.set(true)}>
        Open from the signal
      </button>
      <Drawer.Root bind:open={open} swipeDirection="left">
        <Drawer.Popup class="lu-drawer">
          <Drawer.Title>Navigation</Drawer.Title>
          <Drawer.Description>Opened by a signal.</Drawer.Description>
          <Drawer.Close class="lu-button">Close</Drawer.Close>
        </Drawer.Popup>
      </Drawer.Root>
      <output data-testid="state">open: {String(open())}</output>
    </section>
  );
}
