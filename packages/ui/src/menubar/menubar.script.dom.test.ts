// @vitest-environment happy-dom
// Menubar's script (TASK-379): the bar is one tab stop that follows focus, and the arrow keys,
// Home, End and letters move between its items (Arrow Up and Down when vertical, swapped right to
// left), looping unless `data-loop-focus="false"`; disabled items and the items of its menus are
// skipped. Opening and switching menus needs the popover API: examples/ui-e2e covers them.
import { afterEach, beforeAll, expect, it } from "vitest";

beforeAll(async () => {
  await import("./menubar.script.ts");
});

afterEach(() => {
  document.body.innerHTML = "";
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function menubar(attributes = "") {
  document.body.innerHTML = `<lu-menubar role="menubar" ${attributes}>
    <lu-menu role="none"><button role="menuitem">File</button><div role="menu"><button role="menuitem">New</button></div></lu-menu>
    <lu-menu role="none"><button role="menuitem">Edit</button></lu-menu>
    <lu-menu role="none"><button role="menuitem" disabled>Help</button></lu-menu>
    <lu-menu role="none"><button role="menuitem">View</button></lu-menu>
  </lu-menubar>`;
  await tick();
  const [file, edit, help, view] = [...document.querySelectorAll<HTMLElement>("lu-menu > button")];
  return { file: file!, edit: edit!, help: help!, view: view! };
}

const press = (key: string) =>
  document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));

it("makes the bar one tab stop, which follows focus", async () => {
  const { file, edit, view } = await menubar();
  expect([file.tabIndex, edit.tabIndex, view.tabIndex]).toEqual([0, -1, -1]);
  expect(document.querySelector<HTMLElement>("[role=menu] button")!.hasAttribute("tabindex")).toBe(
    false,
  );
  edit.focus();
  expect([file.tabIndex, edit.tabIndex]).toEqual([-1, 0]);
});

it("moves with the arrows, looping and skipping a disabled item, and with Home, End, letters", async () => {
  const { file, edit, view } = await menubar('aria-orientation="horizontal"');
  file.focus();
  press("ArrowRight");
  expect(document.activeElement).toBe(edit);
  press("ArrowRight");
  expect(document.activeElement).toBe(view);
  press("ArrowRight");
  expect(document.activeElement).toBe(file);
  press("ArrowLeft");
  expect(document.activeElement).toBe(view);
  press("Home");
  expect(document.activeElement).toBe(file);
  press("End");
  expect(document.activeElement).toBe(view);
  press("e");
  expect(document.activeElement).toBe(edit);
  // Arrow Down is a menu's to open, not the bar's.
  press("ArrowDown");
  expect(document.activeElement).toBe(edit);
});

it("moves with Arrow Up and Down when vertical, and stops at the ends without looping", async () => {
  const { file, edit } = await menubar('aria-orientation="vertical" data-loop-focus="false"');
  file.focus();
  press("ArrowUp");
  expect(document.activeElement).toBe(file);
  press("ArrowDown");
  expect(document.activeElement).toBe(edit);
  press("ArrowRight");
  expect(document.activeElement).toBe(edit);
});
