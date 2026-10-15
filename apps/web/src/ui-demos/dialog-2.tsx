// Generated from packages/ui/docs/dialog.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Dialog } from "@lumiose/ui";
import { signal } from "lumiose";

export function EditProfile() {
  const open = signal(false);
  const saved = signal("");
  return (
    <>
      <button type="button" class="lu-button" onClick={() => open.set(true)}>
        Edit profile
      </button>
      <Dialog.Root bind:open={open}>
        <Dialog.Popup
          class="lu-dialog"
          on:close={(event) => saved.set(event.currentTarget.returnValue)}
        >
          <Dialog.Title>Edit profile</Dialog.Title>
          <Dialog.Description>Your name as others see it.</Dialog.Description>
          <footer>
            <Dialog.Close class="lu-button" data-variant="primary" value="save">
              Save
            </Dialog.Close>
          </footer>
        </Dialog.Popup>
      </Dialog.Root>
      <p>{open() ? "Editing…" : `Last answer: ${saved() || "none"}`}</p>
    </>
  );
}
