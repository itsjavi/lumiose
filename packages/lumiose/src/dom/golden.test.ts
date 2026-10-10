// @vitest-environment happy-dom
// oxlint-disable no-underscore-dangle -- names mirror the compiler output of doc-2 §5
// Hand-compiled versions of the golden examples of contract doc-2 §5 (the compiler is not ready),
// run against the runtime as compiled code would.
import { afterEach, describe, expect, it } from "vitest";
import { flush, signal, type Signal } from "../core/index.ts";
import {
  bind,
  createComponent,
  delegateEvents,
  insert,
  list,
  render,
  selector,
  setText,
  template,
  toggleClass,
} from "./index.ts";

type Slots = Record<string, unknown>;

// Hoisted apply functions, as the compiler emits them at module scope.
const _a0 = (el: Element, v: boolean): void => toggleClass(el, "hot", v);
const _aDanger = (el: Element, v: boolean): void => toggleClass(el, "danger", v);

afterEach(() => {
  document.body.textContent = "";
});

describe("golden examples (doc-2 §5)", () => {
  it("5.1 Counter: dynamic text, delegated event, class object", () => {
    const _t0 = template(`<button data-l-c1>Clicked <!> times`);
    function Counter(props: { start?: number }) {
      const count = signal(props.start === undefined ? 0 : props.start);
      const _el = _t0();
      bind(_el, () => count() > 5, _a0);
      (_el as unknown as Slots).$$click = () => count.update((c) => c + 1);
      insert(_el, count, _el.firstChild!.nextSibling);
      return _el;
    }
    delegateEvents(["click"]);

    const app = document.createElement("div");
    document.body.appendChild(app);
    render(() => createComponent(Counter, { start: 4 }), app);
    const button = app.firstElementChild as HTMLButtonElement;
    expect(button.innerHTML).toBe(`Clicked 4<!----> times`);
    expect(button.hasAttribute("data-l-c1")).toBe(true);
    button.click();
    expect(button.textContent).toBe("Clicked 5 times");
    expect(button.className).toBe("");
    button.click();
    expect(button.textContent).toBe("Clicked 6 times");
    expect(button.className).toBe("hot");
  });

  it("5.2 keyed list with selector and a data-slot event", () => {
    interface Row {
      id: number;
      label: Signal<string>;
    }
    const _t = template(`<table><tbody>`);
    const _t1 = template(`<tr data-l-x><td data-l-x><a data-l-x> `);
    const selected = signal<number | undefined>(undefined);
    const select = (id: number): void => selected.set(id);
    const _selectHandler = (id: number): void => select(id);
    const rows = signal<Row[]>([1, 2, 3].map((id) => ({ id, label: signal(`row ${id}`) })));
    function Table() {
      const _el = _t();
      const _tbody = _el.firstChild!;
      const _isSel = selector(selected);
      list(_tbody, null, rows, (row) => {
        const _tr = _t1();
        const _a = _tr.firstChild!.firstChild as Element & Slots;
        bind(_tr, () => _isSel(row.id), _aDanger);
        _a.$$click = _selectHandler;
        _a.$$clickData = row.id;
        bind(_a.firstChild as Text, row.label, setText);
        return _tr;
      });
      return _el;
    }
    delegateEvents(["click"]);

    const app = document.createElement("div");
    document.body.appendChild(app);
    render(() => createComponent(Table, {}), app);
    const anchors = (): HTMLElement[] => Array.from(app.querySelectorAll("a"));
    expect(anchors().map((a) => a.textContent)).toEqual(["row 1", "row 2", "row 3"]);
    anchors()[1]!.click();
    expect(app.querySelectorAll("tr.danger")).toHaveLength(1);
    expect(app.querySelector("tr.danger")!.textContent).toBe("row 2");
    rows()[1]!.label.set("row 2 !!!");
    flush();
    expect(anchors()[1]!.textContent).toBe("row 2 !!!");
    rows.set(rows().toReversed());
    flush();
    expect(anchors().map((a) => a.textContent)).toEqual(["row 3", "row 2 !!!", "row 1"]);
    anchors()[0]!.click();
    expect(app.querySelector("tr.danger")!.textContent).toBe("row 3");
  });
});
