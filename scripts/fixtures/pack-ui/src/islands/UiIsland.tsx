import { Dialog } from "@lumiose/ui";
import { signal } from "lumiose";

/** A dialog in an island: `onOpenChange` updates a signal once the island has hydrated. */
export function UiIsland() {
  const open = signal(false);
  return (
    <section>
      <Dialog.Root open={open()} onOpenChange={(next) => open.set(next)}>
        <Dialog.Trigger>Edit profile</Dialog.Trigger>
        <Dialog.Popup>
          <Dialog.Title>Edit profile</Dialog.Title>
          <Dialog.Close>Save</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Root>
      <output data-testid="island-state">open: {String(open())}</output>
    </section>
  );
}
