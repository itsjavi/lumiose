// A caller's `id` on a part (TASK-441 M39): the server renders once, in order, so a part names
// itself with it wherever nothing earlier in the page points at it (triggers, tabs, items, titles,
// labels, a toast, a slider), and the parts after it point at that id. A part that an earlier one
// points at (a popup, a panel, a field's control) keeps its generated id, which those references
// use. Server HTML; the browser renders the same parts in the same order.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { Accordion } from "./accordion/accordion.tsx";
import { Collapsible } from "./collapsible/collapsible.tsx";
import { Combobox } from "./combobox/combobox.tsx";
import { Dialog } from "./dialog/dialog.tsx";
import { Menu } from "./menu/menu.tsx";
import { Meter } from "./meter/meter.tsx";
import { NavigationMenu } from "./navigation-menu/navigation-menu.tsx";
import { Popover } from "./popover/popover.tsx";
import { Progress } from "./progress/progress.tsx";
import { Slider } from "./slider/slider.tsx";
import { Tabs } from "./tabs/tabs.tsx";
import { Toast } from "./toast/toast.tsx";
import { attrs } from "./test/html.ts";

describe("a caller's id on the server (TASK-441 M39)", () => {
  it("names Accordion's and Collapsible's triggers; the panels keep theirs", async () => {
    const html = await renderToString(() => (
      <>
        <Accordion.Root>
          <Accordion.Item value="shipping">
            <Accordion.Trigger id="faq-shipping">Shipping</Accordion.Trigger>
            <Accordion.Panel id="ignored-panel">Two days.</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
        <Collapsible.Root>
          <Collapsible.Trigger id="details">Details</Collapsible.Trigger>
          <Collapsible.Panel>More.</Collapsible.Panel>
        </Collapsible.Root>
      </>
    ));
    const trigger = attrs(html, "summary", (a) => a.id === "faq-shipping");
    const panel = attrs(html, "div", (a) => a.role === "region");
    expect(panel["aria-labelledby"]).toBe("faq-shipping");
    expect(panel.id).not.toBe("ignored-panel");
    expect(trigger["aria-controls"]).toBe(panel.id);
    expect(attrs(html, "summary", (a) => a.id === "details")["aria-controls"]).toBeTruthy();
  });

  it("names Menu's and Navigation Menu's triggers; the popups keep theirs", async () => {
    const html = await renderToString(() => (
      <>
        <Menu.Root>
          <Menu.Trigger id="actions">Actions</Menu.Trigger>
          <Menu.Popup>
            <Menu.Item>Rename</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
        <NavigationMenu.Root aria-label="Main">
          <NavigationMenu.List>
            <NavigationMenu.Item value="learn">
              <NavigationMenu.Trigger id="learn">Learn</NavigationMenu.Trigger>
              <NavigationMenu.Content>Guides</NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      </>
    ));
    const actions = attrs(html, "button", (a) => a.id === "actions");
    const menu = attrs(html, "div", (a) => a.role === "menu");
    expect(menu["aria-labelledby"]).toBe("actions");
    expect(actions.popovertarget).toBe(menu.id);
    const learn = attrs(html, "button", (a) => a.id === "learn");
    expect(attrs(html, "div", (a) => a.id === learn.popovertarget)).toBeTruthy();
  });

  it("names Tabs' tabs; their panels point at them", async () => {
    const html = await renderToString(() => (
      <Tabs.Root>
        <Tabs.List aria-label="Settings">
          <Tabs.Tab value="billing" id="billing-tab">
            Billing
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="billing">Invoices</Tabs.Panel>
      </Tabs.Root>
    ));
    const tab = attrs(html, "button", (a) => a.id === "billing-tab");
    const panel = attrs(html, "div", (a) => a.role === "tabpanel");
    expect(panel["aria-labelledby"]).toBe("billing-tab");
    expect(tab["aria-controls"]).toBe(panel.id);
  });

  it("names Combobox's label and options; the listbox points at the label", async () => {
    const html = await renderToString(() => (
      <Combobox.Root>
        <Combobox.Label id="fruit-label">Fruit</Combobox.Label>
        <Combobox.Input />
        <Combobox.List>
          <Combobox.Item value="pear" id="fruit-pear">
            Pear
          </Combobox.Item>
        </Combobox.List>
      </Combobox.Root>
    ));
    expect(attrs(html, "label").id).toBe("fruit-label");
    expect(attrs(html, "div", (a) => a.role === "listbox")["aria-labelledby"]).toBe("fruit-label");
    expect(attrs(html, "div", (a) => a.role === "option").id).toBe("fruit-pear");
  });

  it("names Dialog's and Popover's titles and descriptions; the popups point at them", async () => {
    const html = await renderToString(() => (
      <>
        <Dialog.Root>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Popup>
            <Dialog.Title id="dialog-title">Settings</Dialog.Title>
            <Dialog.Description id="dialog-description">General.</Dialog.Description>
          </Dialog.Popup>
        </Dialog.Root>
        <Popover.Root>
          <Popover.Trigger>Help</Popover.Trigger>
          <Popover.Popup>
            <Popover.Title id="popover-title">Help</Popover.Title>
            <Popover.Description id="popover-description">Read on.</Popover.Description>
          </Popover.Popup>
        </Popover.Root>
      </>
    ));
    expect(attrs(html, "dialog")).toMatchObject({
      "aria-labelledby": "dialog-title",
      "aria-describedby": "dialog-description",
    });
    expect(attrs(html, "div", (a) => a.popover !== undefined)).toMatchObject({
      "aria-labelledby": "popover-title",
      "aria-describedby": "popover-description",
    });
  });

  it("names a toast, which its Close points at", async () => {
    const html = await renderToString(() => (
      <Toast.Viewport>
        <Toast.Root toast={{ title: "Saved" }} id="saved-toast">
          <Toast.Title />
          <Toast.Close aria-label="Close">×</Toast.Close>
        </Toast.Root>
      </Toast.Viewport>
    ));
    expect(attrs(html, "div", (a) => a.id === "saved-toast")).toBeTruthy();
    expect(attrs(html, "button").commandfor).toBe("saved-toast");
  });

  it("names a slider and its label, and Progress's and Meter's labels; thumbs and tracks keep theirs", async () => {
    const html = await renderToString(() => (
      <>
        <Slider.Root id="volume" defaultValue={[20, 80]}>
          <Slider.Label id="volume-label">Volume</Slider.Label>
          <Slider.Control>
            <Slider.Thumb />
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
        <Progress.Root value={30}>
          <Progress.Label id="upload-label">Uploading</Progress.Label>
          <Progress.Track />
        </Progress.Root>
        <Meter.Root value={60}>
          <Meter.Label id="storage-label">Storage</Meter.Label>
          <Meter.Track />
        </Meter.Root>
      </>
    ));
    expect(attrs(html, "lu-slider").id).toBe("volume");
    const thumb = attrs(html, "input");
    expect(thumb["aria-labelledby"]).toBe("volume-label");
    expect(attrs(html, "label", (a) => a.id === "volume-label").for).toBe(thumb.id);
    expect(attrs(html, "div", (a) => a.role === "group")["aria-labelledby"]).toBe("volume-label");
    const upload = attrs(html, "label", (a) => a.id === "upload-label");
    expect(attrs(html, "progress").id).toBe(upload.for);
    const storage = attrs(html, "label", (a) => a.id === "storage-label");
    expect(attrs(html, "meter").id).toBe(storage.for);
  });
});
