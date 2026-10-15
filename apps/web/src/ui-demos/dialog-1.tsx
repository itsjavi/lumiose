// Generated from packages/ui/docs/dialog.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Dialog } from "@lumiose/ui";

export function DeleteProject() {
  return (
    <Dialog.Root role="alertdialog">
      <Dialog.Trigger class="lu-button">Delete project…</Dialog.Trigger>
      <Dialog.Popup class="lu-dialog">
        <Dialog.Title>Delete project?</Dialog.Title>
        <Dialog.Description>This removes the project and its deployments.</Dialog.Description>
        <footer>
          <Dialog.Close class="lu-button" value="cancel">
            Cancel
          </Dialog.Close>
          <Dialog.Close class="lu-button" data-variant="destructive" value="delete">
            Delete
          </Dialog.Close>
        </footer>
      </Dialog.Popup>
    </Dialog.Root>
  );
}
