// Server HTML of Popover (TASK-356): the markup alone must open, place, label and close the
// popover, since a server-rendered page ships no JavaScript for it. Behaviour in a browser is
// checked by examples/ui-e2e.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { attrs } from "../test/html.ts";
import { Popover } from "./popover.tsx";

const one = () => (
  <Popover.Root>
    <Popover.Trigger>Open</Popover.Trigger>
    <Popover.Popup aria-label="One" />
  </Popover.Root>
);

describe("Popover on the server", () => {
  it("wires the trigger, the anchor, the labels and the close button by id", async () => {
    const html = await renderToString(() => (
      <Popover.Root>
        <Popover.Trigger class="trigger">Notifications</Popover.Trigger>
        <Popover.Popup class="popup">
          <Popover.Title>Notifications</Popover.Title>
          <Popover.Description>All caught up.</Popover.Description>
          <Popover.Close>Close</Popover.Close>
        </Popover.Popup>
      </Popover.Root>
    ));
    const popup = attrs(html, "div");
    const trigger = attrs(html, "button");
    const close = attrs(html, "button", (a) => a.popovertargetaction === "hide");

    expect(trigger).toMatchObject({
      type: "button",
      class: "trigger",
      popovertarget: popup.id,
      "aria-haspopup": "dialog",
    });
    // aria-expanded comes from the browser (popovertarget) and then the client script: a server
    // value would go stale when the popover opens without JavaScript.
    expect(trigger).not.toHaveProperty("aria-expanded");
    const anchor = /anchor-name:\s*(--lu-[\w-]+)/.exec(trigger.style!)![1];
    expect(popup).toMatchObject({
      class: "popup",
      popover: "auto",
      role: "dialog",
      "data-side": "bottom",
      "data-align": "center",
      "aria-labelledby": attrs(html, "h2").id,
      "aria-describedby": attrs(html, "p").id,
    });
    expect(popup.style).toMatch(new RegExp(`position-anchor:\\s*${anchor}`));
    expect(close).toMatchObject({ type: "button", popovertarget: popup.id });
  });

  it("writes the placement props as attributes and offsets", async () => {
    const html = await renderToString(() => (
      <Popover.Root>
        <Popover.Trigger style="color: red">Open</Popover.Trigger>
        <Popover.Popup
          aria-label="Placed"
          side="inline-end"
          align="start"
          sideOffset={8}
          alignOffset={-2}
          style={{ "max-inline-size": "20rem" }}
        />
      </Popover.Root>
    ));
    const popup = attrs(html, "div");
    expect(popup).toMatchObject({ "data-side": "inline-end", "data-align": "start" });
    expect(popup.style).toMatch(/--lu-side-offset:\s*8px/);
    expect(popup.style).toMatch(/--lu-align-offset:\s*-2px/);
    expect(popup.style).toMatch(/max-inline-size:\s*20rem/);
    // The caller's own style comes after the anchor name, so it wins.
    expect(attrs(html, "button").style).toMatch(/anchor-name:\s*--lu-[\w-]+;\s*color: red/);
  });

  it("references only the Title and Description it renders", async () => {
    const html = await renderToString(() => (
      <Popover.Root>
        <Popover.Popup aria-label="Plain">Text</Popover.Popup>
      </Popover.Root>
    ));
    const popup = attrs(html, "div");
    expect(popup).not.toHaveProperty("aria-labelledby");
    expect(popup).not.toHaveProperty("aria-describedby");
  });

  it("gives each popover its own ids and anchor names", async () => {
    const html = await renderToString(() => (
      <>
        {one()}
        {one()}
      </>
    ));
    const anchors = [...html.matchAll(/position-anchor:\s*(--lu-[\w-]+)/g)].map((m) => m[1]);
    expect(anchors).toHaveLength(2);
    expect(anchors[0]).not.toBe(anchors[1]);
  });

  it("marks a trigger that opens on hover, with its delays (TASK-394)", async () => {
    const html = await renderToString(() => (
      <Popover.Root>
        <Popover.Trigger openOnHover delay={200} closeDelay={100}>
          Profile
        </Popover.Trigger>
        <Popover.Popup aria-label="Profile" />
      </Popover.Root>
    ));
    const popup = attrs(html, "div");
    expect(attrs(html, "button")).toMatchObject({
      "data-open-on-hover": "",
      "data-delay": "200",
      "data-close-delay": "100",
      popovertarget: popup.id,
    });
  });

  it("renders a modal popover as a modal dialog opened by an invoker command (TASK-394)", async () => {
    const html = await renderToString(() => (
      <Popover.Root modal>
        <Popover.Trigger openOnHover>Rename</Popover.Trigger>
        <Popover.Popup side="top" align="start">
          <Popover.Title>Rename</Popover.Title>
          <Popover.Close>Cancel</Popover.Close>
        </Popover.Popup>
      </Popover.Root>
    ));
    const dialog = attrs(html, "dialog");
    expect(dialog).toMatchObject({
      "aria-labelledby": expect.stringMatching(/-title$/),
      "data-side": "top",
      "data-align": "start",
      closedby: "any",
    });
    expect(dialog).not.toHaveProperty("popover");
    const [trigger, close] = [
      attrs(html, "button"),
      attrs(html, "button", (a) => a.command === "close"),
    ];
    // A modal popover does not open on hover.
    expect(trigger).toEqual({
      type: "button",
      "aria-haspopup": "dialog",
      style: expect.stringContaining("anchor-name"),
      command: "show-modal",
      commandfor: dialog.id,
      "aria-expanded": "false",
    });
    expect(close).toEqual({ type: "button", command: "close", commandfor: dialog.id });
  });

  it("throws when a part is outside Popover.Root", async () => {
    await expect(renderToString(() => <Popover.Title>Lost</Popover.Title>)).rejects.toThrow(
      "Popover parts must be inside <Popover.Root>.",
    );
  });
});
