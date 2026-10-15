import { Dialog } from "@lumiose/ui";
import { signal } from "lumiose";

/** Dialog bound to signals: `open` and `onOpenChange` keep a signal in sync both ways. */
export function DialogSignals(props: { initiallyOpen?: boolean }) {
  const open = signal(props.initiallyOpen ?? false);
  const returned = signal("");
  return (
    <section>
      <Dialog.Root open={open()} onOpenChange={(next) => open.set(next)}>
        <Dialog.Trigger class="button">Edit profile</Dialog.Trigger>
        <Dialog.Popup
          class="dialog"
          on:close={(event) => returned.set(event.currentTarget.returnValue)}
        >
          <Dialog.Title>Edit profile</Dialog.Title>
          <Dialog.Description>Opened from the trigger or from a signal.</Dialog.Description>
          <footer>
            <Dialog.Close class="button" value="cancel">
              Cancel
            </Dialog.Close>
            <Dialog.Close class="button" value="save">
              Save
            </Dialog.Close>
          </footer>
        </Dialog.Popup>
      </Dialog.Root>
      <button
        type="button"
        class="button"
        data-testid="open-by-signal"
        onClick={() => open.set(true)}
      >
        Open with a signal
      </button>
      <output data-testid="dialog-state">
        open: {String(open())}, returned: {returned() || "none"}
      </output>
    </section>
  );
}
