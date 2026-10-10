// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { effect, flush, signal } from "../core/index.ts";
import { createOwner, disposeOwner, runWithOwner } from "../core/internal.ts";
import { delegateEvents, listen, render, template } from "./index.ts";
import { Portal } from "./public.ts";

type Slots = Record<string, unknown>;
const slots = (node: Node): Slots => node as unknown as Slots;

const tTree = template(`<section><div><button><span>x`);

function mountTree(): {
  container: HTMLElement;
  section: Element;
  div: Element;
  button: HTMLButtonElement;
  span: Element;
  dispose: () => void;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let section!: Element;
  const dispose = render(() => (section = tTree()), container);
  const div = section.firstElementChild!;
  const button = div.firstElementChild as HTMLButtonElement;
  return { container, section, div, button, span: button.firstElementChild!, dispose };
}

afterEach(() => {
  document.body.textContent = "";
});

describe("delegateEvents", () => {
  it("registers one document listener per event type", () => {
    const add = vi.spyOn(document, "addEventListener");
    delegateEvents(["dblclick", "keyup"]);
    delegateEvents(["dblclick"]);
    expect(add.mock.calls.map((c) => c[0])).toEqual(["dblclick", "keyup"]);
    add.mockRestore();
  });

  it("walks from the target up, with currentTarget set to each handler's element", () => {
    delegateEvents(["click"]);
    const { section, div, span, dispose } = mountTree();
    const log: string[] = [];
    slots(span).$$click = (e: Event) => log.push(`span:${(e.currentTarget as Element).tagName}`);
    slots(div).$$click = (e: Event) => log.push(`div:${(e.currentTarget as Element).tagName}`);
    slots(section).$$click = () => log.push("section");
    (span as HTMLElement).click();
    expect(log).toEqual(["span:SPAN", "div:DIV", "section"]);
    dispose();
  });

  it("passes data slots as the first argument, even when the data is undefined", () => {
    delegateEvents(["click"]);
    const { div, button, dispose } = mountTree();
    const seen: unknown[][] = [];
    const shared = (...args: unknown[]): void => {
      seen.push(args);
    };
    slots(button).$$click = shared;
    slots(button).$$clickData = 42;
    slots(div).$$click = shared;
    slots(div).$$clickData = undefined;
    button.click();
    expect(seen.map((args) => args[0])).toEqual([42, undefined]);
    expect(seen.every((args) => args[1] instanceof Event)).toBe(true);
    dispose();
  });

  it("stops when a handler cancels bubbling, and at the app root", () => {
    delegateEvents(["click"]);
    const { container, div, button, span, dispose } = mountTree();
    const log: string[] = [];
    slots(container).$$click = () => log.push("outside the root");
    slots(document.body).$$click = () => log.push("body");
    slots(span).$$click = () => log.push("span");
    slots(button).$$click = (e: Event) => {
      log.push("button");
      e.stopPropagation();
    };
    slots(div).$$click = () => log.push("div");
    (span as HTMLElement).click();
    expect(log).toEqual(["span", "button"]);
    slots(button).$$click = undefined;
    (span as HTMLElement).click();
    expect(log).toEqual(["span", "button", "span", "div"]);
    dispose();
  });

  it("skips disabled elements", () => {
    delegateEvents(["keyup"]);
    const { div, button, dispose } = mountTree();
    const log: string[] = [];
    slots(button).$$keyup = () => log.push("button");
    slots(div).$$keyup = () => log.push("div");
    button.disabled = true;
    button.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
    expect(log).toEqual(["div"]);
    dispose();
  });

  it("batches writes made by handlers until the walk ends", () => {
    delegateEvents(["click"]);
    const { div, button, dispose } = mountTree();
    const a = signal(0);
    const b = signal(0);
    const runs: string[] = [];
    const owner = createOwner(undefined);
    runWithOwner(owner, () => effect(() => void runs.push(`${a()}-${b()}`)));
    flush();
    slots(button).$$click = () => a.set(1);
    slots(div).$$click = () => {
      expect(runs).toEqual(["0-0"]);
      b.set(1);
    };
    button.click();
    expect(runs).toEqual(["0-0", "1-1"]);
    disposeOwner(owner);
    dispose();
  });

  it("continues from a portal's content at the portal's position", () => {
    delegateEvents(["click"]);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const log: string[] = [];
    const inner = document.createElement("em");
    slots(inner).$$click = () => log.push("inner");
    const host = template(`<article>`)();
    slots(host).$$click = () => log.push("host");
    const dispose = render(() => {
      host.appendChild(Portal({ children: inner }) as Node);
      return host;
    }, container);
    expect(inner.parentElement!.parentElement).toBe(document.body);
    inner.click();
    expect(log).toEqual(["inner", "host"]);
    dispose();
    expect(inner.isConnected).toBe(false);
  });
});

describe("listen", () => {
  it("adds a native listener removed with the owner", () => {
    const el = document.createElement("div");
    const log: string[] = [];
    const owner = createOwner(undefined);
    runWithOwner(owner, () => listen(el, "scroll", () => log.push("scroll")));
    el.dispatchEvent(new Event("scroll"));
    disposeOwner(owner);
    el.dispatchEvent(new Event("scroll"));
    expect(log).toEqual(["scroll"]);
  });
});
