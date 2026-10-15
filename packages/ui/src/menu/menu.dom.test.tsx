// @vitest-environment happy-dom
// Menu in the browser build (TASK-357): the `lu-menu` element's keyboard, focus and item behaviour,
// and the components' sync with signals. happy-dom has no popover API, top layer or layout, so a
// stub below stands in for `showPopover`, `hidePopover`, `:popover-open`, `:dir()` and the boxes
// of rendered items, firing toggle events synchronously; examples/ui-e2e checks the real thing in
// Chromium.
import { flush, signal } from "lumiose";
import { render } from "lumiose/dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Menu } from "./menu.tsx";
import type { MenuElement } from "./menu.script.ts";

// The popover stub ----------------------------------------------------------------------------

const shown = new Set<HTMLElement>();

function fire(element: HTMLElement, type: string, newState: "open" | "closed") {
  const oldState = newState === "open" ? "closed" : "open";
  element.dispatchEvent(Object.assign(new Event(type), { newState, oldState }));
}

/** Whether `popover`, or a popover around it, is closed. */
function closed(popover: HTMLElement | null): boolean {
  return (
    popover !== null &&
    (!shown.has(popover) || closed(popover.parentElement?.closest("[popover]") ?? null))
  );
}

function hide(element: HTMLElement) {
  if (!shown.has(element)) return;
  // Popovers nested in it close first, as in the auto popover stack.
  for (const other of shown) if (other !== element && element.contains(other)) hide(other);
  fire(element, "beforetoggle", "closed");
  shown.delete(element);
  fire(element, "toggle", "closed");
}

beforeAll(() => {
  const proto = HTMLElement.prototype as HTMLElement & Record<string, unknown>;
  proto.showPopover = function (this: HTMLElement) {
    if (shown.has(this)) return;
    // Opening closes the open popovers that are not its ancestors.
    for (const other of shown) if (!other.contains(this)) hide(other);
    fire(this, "beforetoggle", "open");
    shown.add(this);
    fire(this, "toggle", "open");
  };
  proto.hidePopover = function (this: HTMLElement) {
    hide(this);
  };
  const matches = Element.prototype.matches;
  Element.prototype.matches = function (this: Element, selector: string) {
    if (selector === ":popover-open") return shown.has(this as HTMLElement);
    if (selector === ":dir(rtl)") return this.closest("[dir]")?.getAttribute("dir") === "rtl";
    return matches.call(this, selector);
  } as typeof matches;
  // Rendered: not hidden, and every popover around it is open.
  Element.prototype.getClientRects = function (this: Element) {
    const rendered = !this.closest("[hidden]") && !closed(this.closest("[popover]"));
    return (rendered ? [new DOMRect(0, 0, 10, 10)] : []) as unknown as DOMRectList;
  };
});

// Helpers -------------------------------------------------------------------------------------

let dispose: (() => void) | undefined;

function mount(ui: () => JSX.Element): HTMLElement {
  const container = document.body.appendChild(document.createElement("div"));
  dispose = render(ui, container);
  flush();
  return container;
}

afterEach(() => {
  for (const element of shown) hide(element);
  dispose?.();
  document.body.innerHTML = "";
});

const active = () => document.activeElement;
const item = (name: string) =>
  [...document.querySelectorAll<HTMLElement>("[role^=menuitem]")].find(
    (element) => element.textContent?.trim() === name,
  )!;
const trigger = (name: string) =>
  [...document.querySelectorAll<HTMLElement>("[aria-haspopup=menu]")].find(
    (element) => element.textContent?.trim() === name,
  )!;
const menuOf = (element: Element) => element.closest<MenuElement>("lu-menu")!;
const checked = () =>
  [...document.querySelectorAll("[aria-checked=true]")].map((element) => element.textContent);

function key(target: Element, name: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: name,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

/** Presses keys on whatever has focus. */
function keys(...names: string[]) {
  for (const name of names) key(active()!, name);
}

function click(target: HTMLElement, init: MouseEventInit = {}) {
  target.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1, ...init }),
  );
}

function Edit(props: { onRename?: () => void; onPinned?: (checked: boolean) => void }) {
  return (
    <>
      <Menu.Root>
        <Menu.Trigger>Edit</Menu.Trigger>
        <Menu.Popup>
          <Menu.Item onClick={props.onRename}>Rename</Menu.Item>
          <Menu.Item disabled>Delete</Menu.Item>
          <Menu.Item hidden>Hidden</Menu.Item>
          <Menu.LinkItem href="#help">Help</Menu.LinkItem>
          <Menu.CheckboxItem onCheckedChange={props.onPinned}>Pinned</Menu.CheckboxItem>
          <Menu.SubmenuRoot>
            <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
            <Menu.Popup>
              <Menu.Item>Email</Menu.Item>
              <Menu.Item>Link</Menu.Item>
            </Menu.Popup>
          </Menu.SubmenuRoot>
          <Menu.Item label="zoom">Zoom in</Menu.Item>
        </Menu.Popup>
      </Menu.Root>
      <button type="button">After</button>
    </>
  );
}

/** Opens the Edit menu from the keyboard, focused on its first item. */
function openEdit() {
  mount(() => <Edit />);
  key(trigger("Edit"), "ArrowDown");
  expect(active()).toBe(item("Rename"));
}

// The element ---------------------------------------------------------------------------------

describe("lu-menu: opening and focus", () => {
  it("opens on Arrow Down at the first item and on Arrow Up at the last", () => {
    mount(() => <Edit />);
    const edit = trigger("Edit");
    expect(edit.hasAttribute("aria-expanded")).toBe(false);
    expect(key(edit, "ArrowDown").defaultPrevented).toBe(true);
    expect(menuOf(edit).open).toBe(true);
    expect(edit.getAttribute("aria-expanded")).toBe("true");
    expect(active()).toBe(item("Rename"));

    keys("Escape");
    expect(menuOf(edit).open).toBe(false);
    expect(edit.getAttribute("aria-expanded")).toBe("false");
    expect(active()).toBe(edit);

    key(edit, "ArrowUp");
    expect(active()).toBe(item("Zoom in"));
  });

  it("focuses the first item after Enter or Space (a click with no detail), the popup after a pointer", () => {
    mount(() => <Edit />);
    const edit = trigger("Edit");
    const menu = menuOf(edit);
    // What `popovertarget` does after the click the keyboard fires.
    click(edit, { detail: 0 });
    menu.popup!.showPopover();
    expect(active()).toBe(item("Rename"));
    menu.popup!.hidePopover();

    click(edit, { detail: 1 });
    menu.popup!.showPopover();
    expect(active()).toBe(menu.popup);
  });

  it("follows focus with data-highlighted", () => {
    openEdit();
    expect(item("Rename").hasAttribute("data-highlighted")).toBe(true);
    keys("ArrowDown");
    expect(item("Rename").hasAttribute("data-highlighted")).toBe(false);
    expect(item("Delete").hasAttribute("data-highlighted")).toBe(true);
  });
});

describe("lu-menu: keyboard navigation", () => {
  it("moves with the arrows, looping, past hidden items and onto disabled ones", () => {
    openEdit();
    keys("ArrowDown");
    expect(active()).toBe(item("Delete"));
    keys("ArrowDown");
    expect(active()).toBe(item("Help"));
    keys("ArrowDown", "ArrowDown", "ArrowDown");
    expect(active()).toBe(item("Zoom in"));
    keys("ArrowDown");
    expect(active()).toBe(item("Rename"));
    keys("ArrowUp");
    expect(active()).toBe(item("Zoom in"));
  });

  it("goes to the ends with Home and End", () => {
    openEdit();
    keys("End");
    expect(active()).toBe(item("Zoom in"));
    keys("Home");
    expect(active()).toBe(item("Rename"));
  });

  it("matches typed text, cycles a repeated letter and matches label", () => {
    mount(() => (
      <Menu.Root>
        <Menu.Trigger>File</Menu.Trigger>
        <Menu.Popup>
          <Menu.Item>Copy</Menu.Item>
          <Menu.Item>Cut</Menu.Item>
          <Menu.Item>Paste</Menu.Item>
          <Menu.Item label="Clear">⌫ Delete</Menu.Item>
          <Menu.Item disabled>Close</Menu.Item>
        </Menu.Popup>
      </Menu.Root>
    ));
    key(trigger("File"), "ArrowDown");
    // A repeated letter cycles through the items that start with it, disabled ones included.
    keys("c");
    expect(active()).toBe(item("Cut"));
    keys("c");
    expect(active()).toBe(item("⌫ Delete"));
    keys("c");
    expect(active()).toBe(item("Close"));
    keys("c");
    expect(active()).toBe(item("Copy"));
    // More letters refine the match from the current item.
    keys("l");
    expect(active()).toBe(item("⌫ Delete"));
    keys("x");
    // "clx" matches nothing: focus stays.
    expect(active()).toBe(item("⌫ Delete"));
  });

  it("starts a new search after a pause, and types Space only during a search", () => {
    openEdit();
    const now = vi.spyOn(performance, "now");
    let t = 10_000;
    const at = (name: string) => {
      t += 10;
      now.mockReturnValue(t);
      return key(active()!, name, {});
    };
    // happy-dom stamps events with performance.now().
    at("h");
    expect(active()).toBe(item("Help"));
    t += 1000;
    at("z");
    expect(active()).toBe(item("Zoom in"));
    t += 1000;
    expect(at(" ").defaultPrevented).toBe(false);
    at("s");
    expect(active()).toBe(item("Share"));
    // Space right after a letter is part of the text, not a click.
    expect(at(" ").defaultPrevented).toBe(true);
    now.mockRestore();
  });

  it("closes on Tab and moves on from the trigger; Shift+Tab stays on the trigger", () => {
    openEdit();
    const tab = key(active()!, "Tab");
    expect(tab.defaultPrevented).toBe(false);
    expect(menuOf(item("Rename")).open).toBe(false);
    expect(active()).toBe(trigger("Edit"));

    key(trigger("Edit"), "ArrowDown");
    const back = key(active()!, "Tab", { shiftKey: true });
    expect(back.defaultPrevented).toBe(true);
    expect(active()).toBe(trigger("Edit"));
  });

  it("ignores keys while composing text", () => {
    openEdit();
    key(active()!, "ArrowDown", { isComposing: true });
    expect(active()).toBe(item("Rename"));
  });
});

describe("lu-menu: items", () => {
  it("closes the menu and focuses the trigger before an item's handlers run", () => {
    let seen: { open: boolean; focus: Element | null } | undefined;
    mount(() => (
      <Edit onRename={() => (seen = { open: menuOf(item("Rename")).open, focus: active() })} />
    ));
    key(trigger("Edit"), "ArrowDown");
    click(item("Rename"));
    expect(seen).toEqual({ open: false, focus: trigger("Edit") });
  });

  it("does not run a disabled item, and keeps the menu open", () => {
    const onClick = vi.fn();
    mount(() => (
      <Menu.Root>
        <Menu.Trigger>Edit</Menu.Trigger>
        <Menu.Popup>
          <Menu.Item disabled onClick={onClick} on:click={onClick}>
            Delete
          </Menu.Item>
        </Menu.Popup>
      </Menu.Root>
    ));
    key(trigger("Edit"), "ArrowDown");
    click(item("Delete"));
    expect(onClick).not.toHaveBeenCalled();
    expect(menuOf(item("Delete")).open).toBe(true);
  });

  it("toggles a checkbox item, fires checkedchange and stays open", () => {
    const changes: boolean[] = [];
    mount(() => <Edit onPinned={(next) => changes.push(next)} />);
    key(trigger("Edit"), "ArrowDown");
    const pinned = item("Pinned");
    expect(pinned.getAttribute("aria-checked")).toBe("false");
    click(pinned);
    click(pinned);
    expect(changes).toEqual([true, false]);
    expect(pinned.getAttribute("aria-checked")).toBe("false");
    expect(menuOf(pinned).open).toBe(true);
  });

  it("checks one radio item per group, and closes when closeOnClick says so", () => {
    mount(() => (
      <Menu.Root>
        <Menu.Trigger>View</Menu.Trigger>
        <Menu.Popup>
          <Menu.RadioGroup defaultValue="a">
            <Menu.RadioItem value="a">A</Menu.RadioItem>
            <Menu.RadioItem value="b">B</Menu.RadioItem>
          </Menu.RadioGroup>
          <Menu.RadioGroup defaultValue="x">
            <Menu.RadioItem value="x">X</Menu.RadioItem>
            <Menu.RadioItem value="y" closeOnClick>
              Y
            </Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Popup>
      </Menu.Root>
    ));
    key(trigger("View"), "ArrowDown");
    click(item("B"));
    expect(checked()).toEqual(["B", "X"]);
    expect(menuOf(item("B")).open).toBe(true);
    click(item("Y"));
    expect(checked()).toEqual(["B", "Y"]);
    expect(menuOf(item("B")).open).toBe(false);
  });

  it("leaves the menu open for a link opened elsewhere", () => {
    openEdit();
    const help = item("Help");
    help.addEventListener("click", (event) => event.preventDefault());
    click(help, { ctrlKey: true });
    expect(menuOf(help).open).toBe(true);
    click(help);
    expect(menuOf(help).open).toBe(false);
  });
});

describe("lu-menu: submenus", () => {
  it("opens with Arrow Right on its first item, closes with Arrow Left back on its trigger", () => {
    openEdit();
    const share = trigger("Share");
    share.focus();
    key(share, "ArrowRight");
    expect(menuOf(item("Email")).open).toBe(true);
    expect(share.getAttribute("aria-expanded")).toBe("true");
    expect(active()).toBe(item("Email"));
    keys("ArrowDown");
    expect(active()).toBe(item("Link"));
    keys("ArrowLeft");
    expect(menuOf(item("Email")).open).toBe(false);
    expect(menuOf(share.parentElement!.parentElement!).open).toBe(true);
    expect(active()).toBe(share);
  });

  it("swaps the arrows right to left", () => {
    document.documentElement.dir = "rtl";
    try {
      openEdit();
      const share = trigger("Share");
      share.focus();
      key(share, "ArrowRight");
      expect(menuOf(item("Email")).open).toBe(false);
      key(share, "ArrowLeft");
      expect(active()).toBe(item("Email"));
      keys("ArrowRight");
      expect(active()).toBe(share);
    } finally {
      document.documentElement.removeAttribute("dir");
    }
  });

  it("closes one level per Escape, and the whole tree when an item runs", () => {
    openEdit();
    const share = trigger("Share");
    const root = menuOf(item("Rename"));
    share.focus();
    key(share, "ArrowRight");
    keys("Escape");
    expect(menuOf(item("Email")).open).toBe(false);
    expect(root.open).toBe(true);
    expect(active()).toBe(share);

    key(share, "ArrowRight");
    click(item("Link"));
    expect(menuOf(item("Email")).open).toBe(false);
    expect(root.open).toBe(false);
    expect(active()).toBe(trigger("Edit"));
  });

  it("an Escape on the trigger of a submenu opened by hover closes the submenu first", () => {
    openEdit();
    const share = trigger("Share");
    share.focus();
    menuOf(item("Email")).popup!.showPopover();
    keys("Escape");
    expect(menuOf(item("Email")).open).toBe(false);
    expect(menuOf(item("Rename")).open).toBe(true);
    expect(active()).toBe(share);
  });
});

// The components and signals ------------------------------------------------------------------

describe("Menu with signals", () => {
  it("opens and closes with the open prop, and reports every change through onOpenChange", () => {
    const open = signal(false);
    const changes: boolean[] = [];
    mount(() => (
      <Menu.Root
        open={open()}
        onOpenChange={(next) => {
          changes.push(next);
          open.set(next);
        }}
      >
        <Menu.Trigger>Edit</Menu.Trigger>
        <Menu.Popup>
          <Menu.SubmenuRoot>
            <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
            <Menu.Popup>
              <Menu.Item>Email</Menu.Item>
            </Menu.Popup>
          </Menu.SubmenuRoot>
          <Menu.Item>Rename</Menu.Item>
        </Menu.Popup>
      </Menu.Root>
    ));
    const menu = menuOf(item("Rename"));
    open.set(true);
    flush();
    expect(menu.open).toBe(true);
    expect(active()).toBe(trigger("Share"));

    // A submenu's openchange stays with the submenu.
    key(trigger("Share"), "ArrowRight");
    keys("Escape");
    expect(changes).toEqual([true]);

    keys("Escape");
    flush();
    expect(changes).toEqual([true, false]);
    expect(open()).toBe(false);
  });

  it("keeps a signal in sync with bind:open", () => {
    const open = signal(false);
    mount(() => (
      <Menu.Root bind:open={open}>
        <Menu.Trigger>Edit</Menu.Trigger>
        <Menu.Popup>
          <Menu.Item>Rename</Menu.Item>
        </Menu.Popup>
      </Menu.Root>
    ));
    const menu = menuOf(item("Rename"));
    open.set(true);
    flush();
    expect(menu.open).toBe(true);
    click(item("Rename"));
    flush();
    expect(open()).toBe(false);
    key(trigger("Edit"), "ArrowDown");
    flush();
    expect(open()).toBe(true);
  });

  it("opens on mount when open starts true", () => {
    mount(() => (
      <Menu.Root open>
        <Menu.Trigger>Edit</Menu.Trigger>
        <Menu.Popup>
          <Menu.Item>Rename</Menu.Item>
        </Menu.Popup>
      </Menu.Root>
    ));
    expect(menuOf(item("Rename")).open).toBe(true);
    expect(active()).toBe(item("Rename"));
  });

  it("keeps a signal in sync with bind:checked, both ways", () => {
    const pinned = signal(true);
    mount(() => (
      <Menu.Root open>
        <Menu.Trigger>Edit</Menu.Trigger>
        <Menu.Popup>
          <Menu.CheckboxItem bind:checked={pinned}>Pinned</Menu.CheckboxItem>
        </Menu.Popup>
      </Menu.Root>
    ));
    const pinnedItem = item("Pinned");
    expect(pinnedItem.getAttribute("aria-checked")).toBe("true");
    click(pinnedItem);
    flush();
    expect(pinned()).toBe(false);
    expect(pinnedItem.getAttribute("aria-checked")).toBe("false");
    pinned.set(true);
    flush();
    expect(pinnedItem.getAttribute("aria-checked")).toBe("true");
  });

  it("keeps a signal in sync with a radio group's bind:value, both ways", () => {
    const sort = signal("name");
    mount(() => (
      <Menu.Root open>
        <Menu.Trigger>Sort</Menu.Trigger>
        <Menu.Popup>
          <Menu.RadioGroup bind:value={sort}>
            <Menu.RadioItem value="name">Name</Menu.RadioItem>
            <Menu.RadioItem value="date">Date</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Popup>
      </Menu.Root>
    ));
    expect(checked()).toEqual(["Name"]);
    click(item("Date"));
    flush();
    expect(sort()).toBe("date");
    expect(checked()).toEqual(["Date"]);
    sort.set("name");
    flush();
    expect(checked()).toEqual(["Name"]);
  });

  it("references a GroupLabel only while it renders", () => {
    const labelled = signal(true);
    mount(() => (
      <Menu.Root>
        <Menu.Trigger>Sort</Menu.Trigger>
        <Menu.Popup>
          <Menu.Group>
            {labelled() ? <Menu.GroupLabel>Sort by</Menu.GroupLabel> : null}
            <Menu.Item>Name</Menu.Item>
          </Menu.Group>
        </Menu.Popup>
      </Menu.Root>
    ));
    const group = document.querySelector("[role=group]")!;
    const label = document.querySelector("[role=presentation]")!;
    expect(group.getAttribute("aria-labelledby")).toBe(label.id);
    labelled.set(false);
    flush();
    expect(group.hasAttribute("aria-labelledby")).toBe(false);
  });

  it("forwards the popup's ref", () => {
    let popup: HTMLDivElement | undefined;
    mount(() => (
      <Menu.Root>
        <Menu.Trigger>Edit</Menu.Trigger>
        <Menu.Popup ref={(element) => (popup = element)}>
          <Menu.Item>Rename</Menu.Item>
        </Menu.Popup>
      </Menu.Root>
    ));
    expect(popup).toBe(menuOf(item("Rename")).popup);
  });
});
