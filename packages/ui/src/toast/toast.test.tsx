// Toast (TASK-371): the server HTML of the viewport and its toasts (a form action's result), and
// the toast manager. Timers, swipes, F6 and the top layer are checked in a browser by
// examples/ui-e2e.
import { renderToString } from "lumiose";
import { describe, expect, it, vi } from "vitest";
import { attrs } from "../test/html.ts";
import { Toast, type ToastObject } from "./toast.tsx";

describe("Toast on the server", () => {
  it("renders the region and a polite, atomic toast with its title and description", async () => {
    const html = await renderToString(() => (
      <Toast.Viewport class="viewport">
        <Toast.Root toast={{ title: "Saved", description: "Your changes are live." }}>
          <Toast.Title />
          <Toast.Description />
          <Toast.Action />
          <Toast.Close aria-label="Close">×</Toast.Close>
        </Toast.Root>
      </Toast.Viewport>
    ));
    expect(attrs(html, "lu-toast-viewport")).toMatchObject({
      role: "region",
      "aria-label": "Notifications (F6)",
      tabindex: "-1",
      class: "viewport",
      "data-limit": "3",
    });
    const root = attrs(html, "div", (a) => a.role === "status");
    expect(root).toMatchObject({
      "aria-atomic": "true",
      "data-timeout": "5000",
      "data-swipe-directions": "down right",
    });
    expect(html).toContain("<h2>Saved</h2>");
    expect(html).toContain("<p>Your changes are live.</p>");
    // No action without actionProps.
    expect([...html.matchAll(/<button/g)]).toHaveLength(1);
    expect(attrs(html, "button")).toMatchObject({
      command: "--close-toast",
      commandfor: root.id,
    });
  });

  it("takes the provider's timeout and limit, the toast's own, and high priority", async () => {
    const html = await renderToString(() => (
      <Toast.Provider timeout={2000} limit={1}>
        <Toast.Viewport>
          <Toast.Root toast={{ title: "A" }} swipeDirection={[]} />
          <Toast.Root toast={{ title: "B", timeout: 0, priority: "high", type: "error" }} />
        </Toast.Viewport>
      </Toast.Provider>
    ));
    expect(attrs(html, "lu-toast-viewport")["data-limit"]).toBe("1");
    const [a, b] = [...html.matchAll(/<div\b[^>]*>/g)].map((match) => attrs(match[0], "div"));
    expect(a).toMatchObject({ role: "status", "data-timeout": "2000" });
    expect(a).not.toHaveProperty("data-swipe-directions");
    expect(b).toMatchObject({ role: "alert", "data-timeout": "0", "data-type": "error" });
  });
});

describe("the toast manager", () => {
  it("adds toasts newest first, updates them in place and replaces by id", () => {
    const manager = Toast.createToastManager();
    const first = manager.add({ title: "One" });
    const toast = manager.toasts()[0]!;
    manager.add({ title: "Two" });
    expect(manager.toasts().map((each) => each.title)).toEqual(["Two", "One"]);
    manager.update(first, { title: "Uno", type: "success" });
    // The same object, read reactively.
    expect(manager.toasts()[1]).toBe(toast);
    expect(toast).toMatchObject({ id: first, title: "Uno", type: "success" });
    manager.add({ id: first, title: "Again" });
    expect(manager.toasts().map((each) => each.title)).toEqual(["Again", "Two"]);
  });

  it("closes one toast or all: they end, and onClose runs once", () => {
    const manager = Toast.createToastManager();
    const onClose = vi.fn();
    const id = manager.add({ title: "One", onClose });
    manager.add({ title: "Two" });
    manager.close(id);
    manager.close(id);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(manager.toasts().map((each: ToastObject) => each.transitionStatus)).toEqual([
      undefined,
      "ending",
    ]);
    manager.close();
    expect(manager.toasts().every((each) => each.transitionStatus === "ending")).toBe(true);
  });

  it("turns a promise toast from loading into success or error", async () => {
    const manager = Toast.createToastManager();
    await expect(
      manager.promise(Promise.resolve(3), {
        loading: "Saving…",
        success: (value) => `Saved ${value}`,
        error: "Failed",
      }),
    ).resolves.toBe(3);
    expect(manager.toasts()[0]).toMatchObject({ title: "Saved 3", type: "success" });
    expect(manager.toasts()[0]!.timeout).toBeUndefined();
    const failing = manager.promise(Promise.reject(new Error("no")), {
      loading: { title: "Uploading…" },
      success: "Done",
      error: (error) => ({ title: String((error as Error).message), priority: "high" }),
    });
    expect(manager.toasts()[0]).toMatchObject({ title: "Uploading…", type: "loading", timeout: 0 });
    await expect(failing).rejects.toThrow("no");
    expect(manager.toasts()[0]).toMatchObject({ title: "no", type: "error", priority: "high" });
  });

  it("gives managers their own ids", () => {
    const a = Toast.createToastManager().add({});
    const b = Toast.createToastManager().add({});
    expect(a).not.toBe(b);
  });
});
