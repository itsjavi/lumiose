// @vitest-environment happy-dom
// The virtualizer in the browser build (TASK-565): the window of rows around the viewport, for the
// window or an element scroller; grids whose columns follow the container's width; measured rows
// through one observer and one write per callback; the focused row kept; scrollToIndex.
// happy-dom has no layout: the container's box, the frames and the ResizeObservers are stand-ins.
import { effect, flush } from "lumiose";
import { render } from "lumiose/dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { frame, installLayout, observers } from "../test/layout.ts";
import { createVirtualizer, type Virtualizer } from "./virtualizer.ts";

let dispose: (() => void) | undefined;
/** The container's box on screen. */
const box = { top: 100, width: 600 };

/** Scrolls the window so that the container's top is at `top` on screen. */
function scrollTo(top: number) {
  box.top = top;
  window.dispatchEvent(new Event("scroll"));
  frame();
}

const stub = (el: HTMLElement) => {
  el.getBoundingClientRect = () => ({ top: box.top, width: box.width }) as DOMRect;
  return el;
};

function mount(ui: () => JSX.Element): HTMLElement {
  const container = document.body.appendChild(document.createElement("div"));
  dispose = render(ui, container);
  flush();
  return container;
}

const shown = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-row]")].map((el) => Number(el.getAttribute("data-row")));

beforeEach(() => {
  box.top = 100;
  box.width = 600;
  installLayout();
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

function list(options: Partial<Parameters<typeof createVirtualizer>[0]> = {}) {
  let v!: Virtualizer;
  const root = mount(() => {
    v = createVirtualizer({ count: 100, size: 50, overscan: 2, ...options });
    return (
      <ul ref={(el) => v.container(stub(el))}>
        {v.items().map((i) => (
          <li key={i} data-row={i} attach={[v.measure]}>
            <button type="button">Item {i}</button>
          </li>
        ))}
      </ul>
    );
  });
  return { v: () => v, root };
}

it("renders the rows near the window's viewport, with the overscan", () => {
  const { v, root } = list();
  // The viewport is [-100, 400] from the container's top: rows 0 to 8, and 2 more.
  expect(v().mounted()).toBe(true);
  expect(shown(root)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(v().total()).toBe(5000);
  expect(v().before()).toBe(0);
  expect(v().after()).toBe(5000 - 11 * 50);

  scrollTo(-1000);
  // [1000, 1500]: rows 20 to 30, and 2 more on each side.
  expect(shown(root)).toEqual([18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]);
  expect(v().range()).toEqual({ start: 18, end: 33 });
  expect(v().before()).toBe(900);
  expect(v().after()).toBe(5000 - 33 * 50);
  expect(v().start(20)).toBe(1000);
});

it("keeps the rows' array while the window does not move, and the rows' elements", () => {
  const { v, root } = list();
  const rows = v().rows();
  const first = root.querySelector('[data-row="3"]');
  scrollTo(90);
  expect(v().rows()).toBe(rows);
  scrollTo(-120);
  expect(v().rows()).not.toBe(rows);
  expect(root.querySelector('[data-row="3"]')).toBe(first);
});

it("fits the columns to the container's width, and renders whole rows", () => {
  box.top = 0;
  let v!: Virtualizer;
  const root = mount(() => {
    v = createVirtualizer({
      count: 50,
      columns: { minWidth: 100 },
      columnGap: 10,
      gap: 10,
      size: 120,
      overscan: 0,
    });
    return (
      <div ref={(el) => v.container(stub(el))}>
        {v.items().map((i) => (
          <div key={i} data-item={i} />
        ))}
      </div>
    );
  });
  const items = () => [...root.querySelectorAll("[data-item]")].length;
  expect(v.columns()).toBe(5);
  expect(v.itemWidth()).toBe(112);
  expect(v.start(2)).toBe(260);
  // [0, 500]: rows 0 to 3 start in it.
  expect(items()).toBe(20);

  box.width = 330;
  for (const observer of observers) observer.fire([...observer.targets], 0);
  frame();
  expect(v.columns()).toBe(3);
  expect(v.total()).toBe(17 * 130 - 10);
  expect(items()).toBe(12);
});

it("measures rows with one observer, and writes each callback's sizes at once", () => {
  const { v, root } = list({ size: 100 });
  const totals: number[] = [];
  const stop = render(() => {
    effect(() => {
      totals.push(v().total());
    });
    return null;
  }, document.createElement("div"));
  flush();
  const rows = [...root.querySelectorAll("[data-row]")];
  const measuring = observers.filter((observer) => observer.targets.has(rows[0]!));
  expect(measuring).toHaveLength(1);
  expect(measuring[0]!.targets.size).toBe(rows.length);

  measuring[0]!.fire(rows, 40);
  flush();
  expect(totals).toEqual([10000, 10000 - rows.length * 60]);
  expect(v().start(3)).toBe(120);
  expect(v().size(3)).toBe(40);
  // The same sizes again change nothing.
  measuring[0]!.fire(rows, 40.2);
  flush();
  expect(totals).toHaveLength(2);
  stop();
});

it("reads the viewport of an element scroller", () => {
  let v!: Virtualizer;
  const scroller = document.createElement("div");
  scroller.getBoundingClientRect = () => ({ top: 50 }) as DOMRect;
  Object.defineProperty(scroller, "clientHeight", { value: 200 });
  const root = mount(() => {
    v = createVirtualizer({ count: 1000, size: 20, overscan: 0, scroller: () => scroller });
    return (
      <table>
        <tbody ref={(el) => v.container(stub(el))}>
          {v.items().map((i) => (
            <tr key={i} data-row={i} aria-rowindex={i + 2} />
          ))}
        </tbody>
      </table>
    );
  });
  // A header of 40px over the body, scrolled by 1000px: the body's top is at 50 + 40 - 1000.
  box.top = 50 + 40 - 1000;
  scroller.dispatchEvent(new Event("scroll"));
  frame();
  // [960, 1160] from the body's top: rows 48 to 57.
  expect(shown(root)).toEqual([48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58]);
  expect(root.querySelector("tr")!.getAttribute("aria-rowindex")).toBe("50");
});

it("keeps the focused row rendered with keepFocused", () => {
  const { v, root } = list({ keepFocused: true });
  root
    .querySelector('[data-row="2"] button')!
    .dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  scrollTo(-2000);
  expect(v().rows()[0]).toBe(2);
  expect(v().rows()[1]).toBe(38);
  expect(root.querySelector('[data-row="2"]')).not.toBeNull();

  root
    .querySelector('[data-row="2"] button')!
    .dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: document.body }));
  flush();
  expect(root.querySelector('[data-row="2"]')).toBeNull();
});

it("scrolls to an index, aligned as asked", () => {
  const scrollBy = vi.fn((options: ScrollToOptions) => {
    box.top -= options.top ?? 0;
  });
  vi.stubGlobal("scrollBy", scrollBy);
  const { v } = list();
  // Row 40 starts at 100 + 2000 on screen; the viewport is 500px tall.
  v().scrollToIndex(40);
  expect(scrollBy).toHaveBeenLastCalledWith({ top: 1650, behavior: undefined });
  frame();
  expect(scrollBy).toHaveBeenCalledTimes(1);

  // Row 39 is in view.
  v().scrollToIndex(39);
  expect(scrollBy).toHaveBeenCalledTimes(1);
  v().scrollToIndex(10, { align: "start", behavior: "smooth" });
  expect(scrollBy).toHaveBeenLastCalledWith({ top: -1050, behavior: "smooth" });
  v().scrollToIndex(20, { align: "center" });
  expect(scrollBy).toHaveBeenLastCalledWith({ top: 275, behavior: undefined });
});
