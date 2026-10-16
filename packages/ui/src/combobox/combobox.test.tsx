// Server HTML of Combobox (TASK-358): the markup carries the roles, the ARIA wiring the script finds
// the parts by, the selection and the anchor, since a server-rendered page runs only the client
// script. Behaviour in a browser (keyboard, focus, forms, axe) is checked by examples/ui-e2e.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { attrs } from "../test/html.ts";
import { Combobox } from "./combobox.tsx";

function City(props: { value?: string; defaultValue?: string }) {
  return (
    <Combobox.Root name="city" required value={props.value} defaultValue={props.defaultValue}>
      <Combobox.Label>City</Combobox.Label>
      <Combobox.Input placeholder="Search" class="input" />
      <Combobox.Trigger aria-label="Show cities" />
      <Combobox.Clear aria-label="Clear" />
      <Combobox.List class="list">
        <Combobox.Group>
          <Combobox.GroupLabel>Germany</Combobox.GroupLabel>
          <Combobox.Item value="ber">Berlin</Combobox.Item>
          <Combobox.Item value="muc" label="Munich" disabled>
            München
          </Combobox.Item>
        </Combobox.Group>
        <Combobox.Item value="new york">New York</Combobox.Item>
      </Combobox.List>
    </Combobox.Root>
  );
}

describe("Combobox on the server", () => {
  it("wires the label, the input and the listbox, and anchors the popup to the input", async () => {
    const html = await renderToString(() => <City />);
    const root = attrs(html, "lu-combobox");
    const label = attrs(html, "label");
    const input = attrs(html, "input");
    const list = attrs(html, "div", (a) => a.role === "listbox");

    expect(root).toMatchObject({ name: "city", required: "" });
    expect(root.id).toBeTruthy();
    expect(label).toMatchObject({ id: `${root.id}-label`, for: input.id });
    expect(input).toMatchObject({
      class: "input",
      placeholder: "Search",
      type: "text",
      role: "combobox",
      autocomplete: "off",
      "aria-autocomplete": "list",
      "aria-expanded": "false",
      "aria-controls": list.id,
      // The element has no role: the input carries `required` for assistive technology.
      "aria-required": "true",
    });
    expect(list).toMatchObject({
      class: "list",
      popover: "manual",
      "aria-labelledby": label.id,
      "data-side": "bottom",
      "data-align": "start",
    });
    expect(list).not.toHaveProperty("aria-multiselectable");
    const anchor = /anchor-name: ?(--[\w-]+)/.exec(input.style!)![1];
    expect(list.style).toContain(`position-anchor:${anchor}`);
  });

  it("renders the options with their values, labels and states, and the groups named", async () => {
    const html = await renderToString(() => <City defaultValue="ber" />);
    const options = (value: string) => attrs(html, "div", (a) => a["data-value"] === value);
    expect(options("ber")).toMatchObject({ role: "option", "aria-selected": "true" });
    expect(options("muc")).toMatchObject({
      role: "option",
      "data-label": "Munich",
      "aria-selected": "false",
      "aria-disabled": "true",
    });
    // Ids from the value, valid with spaces.
    expect(options("new york").id).toMatch(/-option-new_20york$/);
    const group = attrs(html, "div", (a) => a.role === "group");
    const groupLabel = attrs(html, "div", (a) => a.role === "presentation");
    expect(group["aria-labelledby"]).toBe(groupLabel.id);
  });

  it("selects `value` over `defaultValue`", async () => {
    const html = await renderToString(() => <City value="new york" defaultValue="ber" />);
    expect(attrs(html, "div", (a) => a["data-value"] === "new york")["aria-selected"]).toBe("true");
    expect(attrs(html, "div", (a) => a["data-value"] === "ber")["aria-selected"]).toBe("false");
  });

  it("makes the buttons invokers of the element, out of the tab order", async () => {
    const empty = await renderToString(() => <City />);
    const root = attrs(empty, "lu-combobox");
    expect(attrs(empty, "button", (a) => a.command === "--toggle")).toMatchObject({
      type: "button",
      tabindex: "-1",
      commandfor: root.id,
      "aria-label": "Show cities",
    });
    // Clear shows only while there is something to clear.
    expect(attrs(empty, "button", (a) => a.command === "--clear")).toMatchObject({
      commandfor: root.id,
      hidden: "",
    });
    const filled = await renderToString(() => <City defaultValue="ber" />);
    expect(attrs(filled, "button", (a) => a.command === "--clear")).not.toHaveProperty("hidden");
  });

  it("renders a Popup around the list, with the empty state and the status, for multiple", async () => {
    const html = await renderToString(() => (
      <Combobox.Root multiple name="tags" filter="none" disabled>
        <Combobox.Label>Tags</Combobox.Label>
        <Combobox.Chips removeLabel="Quitar" class="chips" />
        <Combobox.Input />
        <Combobox.Popup side="top" sideOffset={8}>
          <Combobox.List>
            <Combobox.Item value="a">A</Combobox.Item>
          </Combobox.List>
          <Combobox.Empty>No tags</Combobox.Empty>
          <Combobox.Status>Loading…</Combobox.Status>
        </Combobox.Popup>
      </Combobox.Root>
    ));
    const root = attrs(html, "lu-combobox");
    expect(root).toMatchObject({ multiple: "", filter: "none", disabled: "" });
    expect(attrs(html, "input")).toHaveProperty("disabled");
    const popup = attrs(html, "div", (a) => a.popover !== undefined);
    expect(popup).toMatchObject({ popover: "manual", "data-side": "top" });
    expect(popup.style).toContain("--lu-side-offset:8px");
    const list = attrs(html, "div", (a) => a.role === "listbox");
    expect(list).not.toHaveProperty("popover");
    expect(list["aria-multiselectable"]).toBe("true");
    expect(attrs(html, "div", (a) => a.role === "list")).toMatchObject({
      id: `${root.id}-chips`,
      class: "chips",
      "data-remove-label": "Quitar",
    });
    const [empty, status] = [...html.matchAll(/<div[^>]*role="status"[^>]*>/g)].map((m) => m[0]);
    expect(empty).toContain(`id="${root.id}-empty"`);
    expect(empty).toContain("hidden");
    expect(status).not.toContain("hidden");
  });
});
