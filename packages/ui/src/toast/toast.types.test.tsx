// Toast's types (TASK-371). Type-level: `pnpm typecheck` checks the code below and its
// `@ts-expect-error` lines; the runtime part only keeps Vitest happy. Never rendered.
import { expect, it } from "vitest";
import { Toast, type ToastManager } from "./toast.tsx";

const toasts: ToastManager = Toast.createToastManager();

export function Typed() {
  toasts.add({ title: "Saved", type: "success", timeout: 0, priority: "high" });
  toasts.add({ actionProps: { children: "Undo", onClick: () => toasts.close() } });
  void toasts.promise(Promise.resolve(1), {
    loading: "Saving…",
    success: (value: number) => ({ title: `Saved ${value}` }),
    error: "Failed",
  });
  // @ts-expect-error: priority is low or high
  toasts.add({ priority: "urgent" });
  return (
    <Toast.Provider toastManager={toasts} timeout={3000} limit={2}>
      <Toast.Viewport aria-label="Alerts" class="viewport">
        {toasts.toasts().map((toast) => (
          <Toast.Root toast={toast} swipeDirection={["left", "up"]} class="toast">
            <Toast.Content>
              <Toast.Title />
              <Toast.Description />
            </Toast.Content>
            <Toast.Action class="action" />
            <Toast.Close aria-label="Close" />
          </Toast.Root>
        ))}
        <Toast.Root toast={{ title: "From the server" }} />
        {/* @ts-expect-error: a toast needs its object */}
        <Toast.Root />
        {/* @ts-expect-error: swipes go up, down, left or right */}
        <Toast.Root toast={{}} swipeDirection={["sideways"]} />
      </Toast.Viewport>
    </Toast.Provider>
  );
}

it("is checked by the type checker", () => {
  expect(typeof Typed).toBe("function");
});
