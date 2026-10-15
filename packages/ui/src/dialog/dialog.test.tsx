// Server HTML of Dialog (TASK-355): the markup alone must open, label and close the dialog, since
// a server-rendered page ships no JavaScript for it. Behaviour in a browser (keyboard, focus,
// axe, no JavaScript) is checked by examples/ui-e2e.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { Dialog } from "./dialog.tsx";

/** The attributes of the first `<tag …>` in `html`. */
function attrs(html: string, tag: string): Record<string, string> {
  const open = new RegExp(`<${tag}\\b([^>]*)>`).exec(html);
  if (!open) throw new Error(`no <${tag}> in ${html}`);
  const out: Record<string, string> = {};
  for (const [, name, value] of open[1]!.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) {
    out[name!] = value ?? "";
  }
  return out;
}

function AlertDialog() {
  return (
    <Dialog.Root role="alertdialog">
      <Dialog.Trigger class="trigger">Delete project…</Dialog.Trigger>
      <Dialog.Popup class="popup">
        <Dialog.Title>Delete project?</Dialog.Title>
        <Dialog.Description>This removes the project.</Dialog.Description>
        <Dialog.Close value="cancel">Cancel</Dialog.Close>
      </Dialog.Popup>
    </Dialog.Root>
  );
}

describe("Dialog on the server", () => {
  it("wires the trigger, the labels and the close button by id", async () => {
    const html = await renderToString(() => <AlertDialog />);
    const dialog = attrs(html, "dialog");
    const trigger = attrs(html, "button");
    const title = attrs(html, "h2");
    const description = attrs(html, "p");
    const close = attrs(html.slice(html.indexOf("<dialog")), "button");

    expect(dialog.id).toBeTruthy();
    expect(trigger).toMatchObject({
      type: "button",
      command: "show-modal",
      commandfor: dialog.id,
      "aria-haspopup": "dialog",
    });
    expect(dialog).toMatchObject({
      role: "alertdialog",
      closedby: "closerequest",
      "aria-labelledby": title.id,
      "aria-describedby": description.id,
    });
    expect(close).toMatchObject({
      type: "button",
      command: "close",
      commandfor: dialog.id,
      value: "cancel",
    });
    // Closed: a modal dialog only opens from a trigger or script.
    expect(dialog).not.toHaveProperty("open");
  });

  it("renders a plain dialog without a role and closes it on any light dismiss", async () => {
    const html = await renderToString(() => (
      <Dialog.Root>
        <Dialog.Popup>
          <Dialog.Title>Settings</Dialog.Title>
        </Dialog.Popup>
      </Dialog.Root>
    ));
    const dialog = attrs(html, "dialog");
    expect(dialog).not.toHaveProperty("role");
    expect(dialog.closedby).toBe("any");
  });

  it("passes props through, and keeps the wiring when they collide", async () => {
    const html = await renderToString(() => (
      <Dialog.Root>
        <Dialog.Trigger class="trigger" id="open-settings" commandfor="elsewhere" data-x="1">
          Settings
        </Dialog.Trigger>
        <Dialog.Popup class="popup" closedby="none" id="mine" aria-describedby={undefined}>
          <Dialog.Title class="title">Settings</Dialog.Title>
        </Dialog.Popup>
      </Dialog.Root>
    ));
    const dialog = attrs(html, "dialog");
    const trigger = attrs(html, "button");
    expect(trigger).toMatchObject({ class: "trigger", id: "open-settings", "data-x": "1" });
    expect(trigger.commandfor).toBe(dialog.id);
    expect(dialog.id).not.toBe("mine");
    expect(dialog).toMatchObject({ class: "popup", closedby: "none" });
    expect(dialog).not.toHaveProperty("aria-describedby");
    expect(attrs(html, "h2").class).toBe("title");
  });

  it("gives each dialog its own ids", async () => {
    const html = await renderToString(() => (
      <>
        <AlertDialog />
        <AlertDialog />
      </>
    ));
    const ids = [...html.matchAll(/<dialog\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("throws when a part is outside Dialog.Root", async () => {
    await expect(renderToString(() => <Dialog.Title>Lost</Dialog.Title>)).rejects.toThrow(
      "Dialog parts must be inside <Dialog.Root>.",
    );
  });
});
