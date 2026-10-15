import { Dialog } from "@lumiose/ui";
import { signal } from "lumiose";

/** Dialog bound to a signal with bind:open (decision-62, TASK-360). */
export function DialogBind() {
  const open = signal(false);
  return (
    <section>
      <Dialog.Root bind:open={open}>
        <Dialog.Trigger class="lu-button">Rename project</Dialog.Trigger>
        <Dialog.Popup class="lu-dialog">
          <Dialog.Title>Rename project</Dialog.Title>
          <Dialog.Description>Bound to a signal with bind:open.</Dialog.Description>
          <footer>
            <Dialog.Close class="lu-button">Done</Dialog.Close>
          </footer>
        </Dialog.Popup>
      </Dialog.Root>
      <button
        type="button"
        class="lu-button"
        data-testid="bind-open"
        onClick={() => open.set(true)}
      >
        Open the bound dialog
      </button>
      <output data-testid="bind-state">open: {String(open())}</output>
    </section>
  );
}
