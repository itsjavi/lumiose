// Generated from packages/ui/docs/toast.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { createToastManager, Toast } from "@lumiose/ui";

export function UploadButton() {
  const toasts = createToastManager();
  const upload = () =>
    toasts
      .promise(new Promise((resolve) => setTimeout(resolve, 1000)), {
        loading: "Uploading…",
        success: "Uploaded",
        error: "Upload failed",
      })
      .catch(() => undefined);
  const fail = () =>
    toasts.add({
      title: "Payment failed",
      description: "Check your card and try again.",
      type: "error",
      priority: "high",
      timeout: 0,
      actionProps: { children: "Retry", class: "lu-button", onClick: upload },
    });
  return (
    <Toast.Provider toastManager={toasts}>
      <button type="button" class="lu-button" onClick={upload}>
        Upload
      </button>
      <button type="button" class="lu-button" data-variant="destructive" onClick={fail}>
        Pay
      </button>
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
