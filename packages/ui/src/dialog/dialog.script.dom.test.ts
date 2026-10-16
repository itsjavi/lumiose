// @vitest-environment happy-dom
// Dialog's client script (TASK-355). happy-dom has neither `closedby` nor invoker commands, so the
// polyfills run here; it has no top layer and fires no toggle events, so the tests dispatch the
// events a browser fires. examples/ui-e2e checks the script in Chromium.
import { afterEach, beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await import("./dialog.script.ts");
});

afterEach(() => {
  document.body.innerHTML = "";
});

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function page(html: string) {
  document.body.innerHTML = html;
  return { dialog: (id = "d") => get<HTMLDialogElement>(id) };
}

const DIALOG = `
  <button id="t" type="button" command="show-modal" commandfor="d">Open</button>
  <dialog id="d" closedby="any"><input id="i"><button id="c" type="button" command="close" commandfor="d" value="done">Done</button></dialog>`;

function press(target: Element, init: PointerEventInit = {}) {
  target.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, isPrimary: true, button: 0, ...init }),
  );
}

function toggle(dialog: HTMLDialogElement, type: "beforetoggle" | "toggle", newState: string) {
  const oldState = newState === "open" ? "closed" : "open";
  dialog.dispatchEvent(Object.assign(new Event(type), { newState, oldState }));
}

/** Gives the dialog a box at (100, 100)–(300, 200). */
function box(dialog: HTMLDialogElement) {
  dialog.getBoundingClientRect = () => new DOMRect(100, 100, 200, 100);
}

describe("invoker commands where the browser lacks them", () => {
  it("opens with show-modal and closes with close, which sets returnValue", () => {
    const { dialog } = page(DIALOG);
    get("t").click();
    expect(dialog().open).toBe(true);
    get("c").click();
    expect(dialog().open).toBe(false);
    expect(dialog().returnValue).toBe("done");
  });

  it("ignores buttons that point at something else", () => {
    const { dialog } = page(`${DIALOG}<button id="x" commandfor="nothing" command="show-modal">`);
    get("x").click();
    expect(dialog().open).toBe(false);
  });
});

describe("light dismiss", () => {
  it("closes on a primary click outside where the browser lacks closedby", () => {
    const { dialog } = page(DIALOG);
    get("t").click();
    box(dialog());
    press(dialog(), { clientX: 10, clientY: 10 });
    dialog().dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 10, clientY: 10 }));
    expect(dialog().open).toBe(false);
  });

  it("stays open for a click inside, a secondary button, a second finger or closedby=closerequest", () => {
    const { dialog } = page(DIALOG);
    get("t").click();
    box(dialog());
    const click = (x: number, init: PointerEventInit = {}) => {
      press(dialog(), { clientX: x, clientY: 150, ...init });
      dialog().dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: 150 }));
    };
    click(150);
    click(10, { button: 2 });
    click(10, { isPrimary: false, pointerType: "touch" });
    expect(dialog().open).toBe(true);
    dialog().setAttribute("closedby", "closerequest");
    click(10);
    expect(dialog().open).toBe(true);
  });

  it("cancels the browser's light dismiss after a secondary press, not after a key", () => {
    const { dialog } = page(DIALOG);
    const cancel = () => {
      const event = new Event("cancel", { cancelable: true });
      dialog().dispatchEvent(event);
      return event.defaultPrevented;
    };
    press(document.body, { button: 2 });
    expect(cancel()).toBe(true);
    press(document.body);
    expect(cancel()).toBe(false);
    press(document.body, { button: 2 });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(cancel()).toBe(false);
  });
});

describe("nesting", () => {
  it("marks a dialog with open dialogs inside, and counts them", () => {
    const { dialog } = page(`
      <dialog id="outer" open><dialog id="middle"><dialog id="inner"></dialog></dialog></dialog>`);
    dialog("middle").setAttribute("open", "");
    toggle(dialog("middle"), "toggle", "open");
    expect(dialog("outer").hasAttribute("data-nested-dialog-open")).toBe(true);
    expect(dialog("outer").style.getPropertyValue("--lu-nested-dialogs")).toBe("1");
    expect(dialog("middle").hasAttribute("data-nested-dialog-open")).toBe(false);

    dialog("inner").setAttribute("open", "");
    toggle(dialog("inner"), "toggle", "open");
    expect(dialog("outer").style.getPropertyValue("--lu-nested-dialogs")).toBe("2");
    expect(dialog("middle").style.getPropertyValue("--lu-nested-dialogs")).toBe("1");

    dialog("inner").removeAttribute("open");
    dialog("middle").removeAttribute("open");
    toggle(dialog("middle"), "toggle", "closed");
    expect(dialog("outer").hasAttribute("data-nested-dialog-open")).toBe(false);
    expect(dialog("outer").style.getPropertyValue("--lu-nested-dialogs")).toBe("");
  });
});

describe("scroll lock", () => {
  it("locks a <body> that scrolls while a modal dialog is open, then restores it", () => {
    const { dialog } = page(DIALOG);
    const { body } = document;
    body.style.overflowY = "auto";
    Object.defineProperty(body, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(body, "clientHeight", { configurable: true, value: 600 });
    toggle(dialog(), "beforetoggle", "open");
    expect(body.style.overflowY).toBe("hidden");
    // happy-dom has no :modal: nothing matches it, as after the last modal dialog closes.
    toggle(dialog(), "toggle", "closed");
    expect(body.style.overflowY).toBe("auto");
    body.removeAttribute("style");
  });
});

describe("focus", () => {
  it("focuses the dialog itself when a touch opened it", () => {
    const { dialog } = page(DIALOG);
    press(get("t"), { pointerType: "touch" });
    toggle(dialog(), "beforetoggle", "open");
    dialog().setAttribute("open", "");
    get("i").focus();
    expect(document.activeElement).toBe(dialog());
    expect(dialog().tabIndex).toBe(-1);
  });

  it("leaves focus on the first field after a mouse press, or on an autofocus element", () => {
    const { dialog } = page(DIALOG);
    press(get("t"), { pointerType: "mouse" });
    toggle(dialog(), "beforetoggle", "open");
    dialog().setAttribute("open", "");
    get("i").focus();
    expect(document.activeElement).toBe(get("i"));

    get("i").blur();
    get("i").setAttribute("autofocus", "");
    press(get("t"), { pointerType: "touch" });
    toggle(dialog(), "beforetoggle", "open");
    get("i").focus();
    expect(document.activeElement).toBe(get("i"));
  });

  it("returns focus to the opener when closing left it nowhere", () => {
    const { dialog } = page(`${DIALOG}<button id="o">Opener</button>`);
    get("o").focus();
    toggle(dialog(), "beforetoggle", "open");
    get("o").blur();
    toggle(dialog(), "toggle", "closed");
    expect(document.activeElement).toBe(get("o"));
  });

  it("falls back to a trigger of the dialog when the opener is gone", () => {
    const { dialog } = page(`${DIALOG}<button id="o">Opener</button>`);
    get("o").focus();
    toggle(dialog(), "beforetoggle", "open");
    get("o").remove();
    toggle(dialog(), "toggle", "closed");
    expect(document.activeElement).toBe(get("t"));
  });

  it("keeps focus where the browser put it", () => {
    const { dialog } = page(`${DIALOG}<button id="o">Opener</button><button id="p">Other</button>`);
    get("o").focus();
    toggle(dialog(), "beforetoggle", "open");
    get("p").focus();
    toggle(dialog(), "toggle", "closed");
    expect(document.activeElement).toBe(get("p"));
  });
});
