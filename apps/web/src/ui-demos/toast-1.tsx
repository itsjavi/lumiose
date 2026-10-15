// Generated from packages/ui/docs/toast.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { createToastManager, Toast } from "@lumiose/ui";

export function SaveButton() {
  const toasts = createToastManager();
  return (
    <Toast.Provider toastManager={toasts}>
      <button
        type="button"
        class="lu-button"
        onClick={() => toasts.add({ title: "Saved", description: "Your changes are live." })}
      >
        Save
      </button>
      <Toast.Viewport class="lu-toast-viewport">
        {toasts.toasts().map((toast) => (
          <Toast.Root class="lu-toast" toast={toast}>
            <Toast.Title />
            <Toast.Description />
            <Toast.Close aria-label="Close">×</Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Provider>
  );
}
