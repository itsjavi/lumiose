// @vitest-environment happy-dom
// Dialog in the browser build (TASK-355): the `open` prop drives the native dialog and its
// `toggle` event drives `onOpenChange`, so a signal stays in sync both ways. happy-dom has no top
// layer and fires no `toggle` events, so the tests dispatch them as the browser would; the real
// browser behaviour is checked by examples/ui-e2e.
import { flush, signal } from "lumiose";
import { render } from "lumiose/dom";
import { afterEach, expect, it } from "vitest";
import { Dialog } from "./dialog.tsx";

let dispose: (() => void) | undefined;

function mount(ui: () => JSX.Element): HTMLElement {
  const container = document.body.appendChild(document.createElement("div"));
  dispose = render(ui, container);
  return container;
}

afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

/** What the browser fires after a dialog opens or closes. */
function toggled(dialog: HTMLDialogElement, newState: "open" | "closed") {
  dialog.dispatchEvent(
    Object.assign(new Event("toggle"), {
      newState,
      oldState: newState === "open" ? "closed" : "open",
    }),
  );
}

function Controlled(props: { open: () => boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={props.open()} onOpenChange={props.onOpenChange}>
      <Dialog.Trigger>Edit</Dialog.Trigger>
      <Dialog.Popup>
        <Dialog.Title>Edit profile</Dialog.Title>
        <Dialog.Close>Done</Dialog.Close>
      </Dialog.Popup>
    </Dialog.Root>
  );
}

it("opens and closes the native dialog when the open prop changes", () => {
  const open = signal(false);
  const container = mount(() => <Controlled open={open} onOpenChange={(next) => open.set(next)} />);
  flush();
  const dialog = container.querySelector("dialog")!;
  expect(dialog.open).toBe(false);

  open.set(true);
  flush();
  expect(dialog.open).toBe(true);

  open.set(false);
  flush();
  expect(dialog.open).toBe(false);
});

it("reports every open and close through onOpenChange", () => {
  const open = signal(false);
  const changes: boolean[] = [];
  const container = mount(() => (
    <Controlled
      open={open}
      onOpenChange={(next) => {
        changes.push(next);
        open.set(next);
      }}
    />
  ));
  flush();
  const dialog = container.querySelector("dialog")!;

  // The trigger's invoker command opened it; Escape or a close button closed it.
  dialog.showModal();
  toggled(dialog, "open");
  dialog.close();
  toggled(dialog, "closed");
  flush();
  expect(changes).toEqual([true, false]);
  expect(open()).toBe(false);
});

it("follows the dialog with the trigger's aria-expanded", () => {
  const container = mount(() => <Controlled open={() => false} onOpenChange={() => {}} />);
  flush();
  const trigger = container.querySelector("button")!;
  const dialog = container.querySelector("dialog")!;
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  dialog.showModal();
  toggled(dialog, "open");
  flush();
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  dialog.close();
  toggled(dialog, "closed");
  flush();
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

it("references the Description only while it is rendered", () => {
  const described = signal(false);
  const container = mount(() => (
    <Dialog.Root>
      <Dialog.Popup>
        <Dialog.Title>Settings</Dialog.Title>
        {described() ? <Dialog.Description>Changes apply at once.</Dialog.Description> : null}
      </Dialog.Popup>
    </Dialog.Root>
  ));
  flush();
  const dialog = container.querySelector("dialog")!;
  const title = container.querySelector("h2")!;
  expect(dialog.getAttribute("aria-labelledby")).toBe(title.id);
  expect(dialog.hasAttribute("aria-describedby")).toBe(false);

  described.set(true);
  flush();
  expect(dialog.getAttribute("aria-describedby")).toBe(container.querySelector("p")!.id);

  described.set(false);
  flush();
  expect(dialog.hasAttribute("aria-describedby")).toBe(false);
});

it("opens on mount when open starts true", () => {
  const container = mount(() => <Controlled open={() => true} onOpenChange={() => {}} />);
  flush();
  expect(container.querySelector("dialog")!.open).toBe(true);
});

it("leaves the dialog alone without the open prop, and forwards the popup's ref", () => {
  let popup: HTMLDialogElement | undefined;
  const container = mount(() => (
    <Dialog.Root>
      <Dialog.Popup ref={(element) => (popup = element)}>
        <Dialog.Title>Uncontrolled</Dialog.Title>
      </Dialog.Popup>
    </Dialog.Root>
  ));
  flush();
  const dialog = container.querySelector("dialog")!;
  expect(popup).toBe(dialog);
  dialog.showModal();
  flush();
  expect(dialog.open).toBe(true);
});
