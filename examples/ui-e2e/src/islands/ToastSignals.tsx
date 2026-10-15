import { Dialog, Popover, Toast } from "@lumiose/ui";

/** The island's toast manager: its buttons add toasts, its viewport shows them (TASK-371). */
const toasts = Toast.createToastManager();
let count = 0;

export function ToastSignals() {
  return (
    <Toast.Provider toastManager={toasts} timeout={1500} limit={3}>
      <section class="actions">
        <button
          type="button"
          class="lu-button"
          onClick={() => toasts.add({ title: `Saved ${(count += 1)}`, description: "Done." })}
        >
          Add a toast
        </button>
        <button
          type="button"
          class="lu-button"
          onClick={() =>
            toasts.add({
              title: "Payment failed",
              description: "Check your card.",
              type: "error",
              priority: "high",
              timeout: 0,
              actionProps: { children: "Retry", class: "lu-button" },
            })
          }
        >
          Add an error
        </button>
        <button
          type="button"
          class="lu-button"
          onClick={() =>
            void toasts.promise(new Promise((resolve) => setTimeout(resolve, 300)), {
              loading: "Uploading…",
              success: { title: "Uploaded", timeout: 0 },
              error: "Upload failed",
            })
          }
        >
          Upload
        </button>
        <button type="button" class="lu-button" onClick={() => toasts.close()}>
          Close all
        </button>
        <Dialog.Root>
          <Dialog.Trigger class="lu-button">Open a dialog</Dialog.Trigger>
          <Dialog.Popup class="lu-dialog">
            <Dialog.Title>Settings</Dialog.Title>
            <Dialog.Description>Toasts stay usable over a modal dialog.</Dialog.Description>
            <footer>
              <button
                type="button"
                class="lu-button"
                onClick={() => toasts.add({ title: "From the dialog", timeout: 0 })}
              >
                Add from the dialog
              </button>
              <Dialog.Close class="lu-button">Close</Dialog.Close>
            </footer>
          </Dialog.Popup>
        </Dialog.Root>
        <Popover.Root>
          <Popover.Trigger class="lu-button">Filters</Popover.Trigger>
          <Popover.Popup class="lu-popover">
            <Popover.Title>Filters</Popover.Title>
            <Popover.Description>A press in a toast leaves this popover open.</Popover.Description>
          </Popover.Popup>
        </Popover.Root>
        <output data-testid="count">toasts: {toasts.toasts().length}</output>
      </section>
      <Toast.Viewport class="lu-toast-viewport">
        {toasts.toasts().map((toast) => (
          <Toast.Root class="lu-toast" toast={toast}>
            <Toast.Title />
            <Toast.Description />
            <Toast.Action />
            <Toast.Close aria-label="Close">×</Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Provider>
  );
}
