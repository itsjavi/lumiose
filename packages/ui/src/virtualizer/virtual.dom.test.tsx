// @vitest-environment happy-dom
// VirtualList, VirtualGrid and VirtualTable in the browser build (TASK-565): rows keyed by the
// item's key keep their elements, their components and the children function's output while their
// items update in place; the list's and the grid's items are placed, the grid's rows as tall as
// their tallest measured cell; the table keeps aria-rowcount and aria-rowindex, with spacer rows.
// happy-dom has no layout: the containers' box, the frames and the observers are stand-ins.
import { flush, signal } from "lumiose";
import { render } from "lumiose/dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { frame, installLayout, observerOf } from "../test/layout.ts";
import type { Virtualizer } from "./virtualizer.ts";
import { VirtualGrid, VirtualList, VirtualTable } from "./virtual.tsx";

type Person = { id: string; name: string };
const people = (count: number, suffix = "") =>
  Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Person ${i}${suffix}` }));

let dispose: (() => void) | undefined;
/** The box of every element with the class `box` (the components' containers). */
const box = { top: 100, width: 600 };

function mount(ui: () => JSX.Element): HTMLElement {
  const container = document.body.appendChild(document.createElement("div"));
  dispose = render(ui, container);
  flush();
  return container;
}

beforeEach(() => {
  box.top = 100;
  box.width = 600;
  installLayout();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    return (this.classList.contains("box") ? { ...box } : { top: 0, width: 0 }) as DOMRect;
  });
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A row's component with local state, which a rebuilt row would lose. */
function Counter(props: { label: string }) {
  const clicks = signal(0);
  return (
    <button type="button" onClick={() => clicks.set(clicks() + 1)}>
      {props.label}: {clicks()}
    </button>
  );
}

it("VirtualList places keyed rows and keeps them, and their state, as their items change", () => {
  const items = signal<Person[]>(people(100));
  let renders = 0;
  const root = mount(() => (
    <VirtualList
      class="box"
      aria-label="People"
      items={items()}
      itemKey={(person) => person.id}
      size={50}
      overscan={2}
    >
      {(row) => {
        renders++;
        return <Counter label={`${row.index}. ${row.item.name}`} />;
      }}
    </VirtualList>
  ));
  const list = root.querySelector("ul")!;
  const rows = () => [...list.querySelectorAll("li")];
  expect(list.hasAttribute("data-mounted")).toBe(true);
  expect(list.getAttribute("aria-label")).toBe("People");
  expect(list.style.height).toBe("5000px");
  expect(rows()).toHaveLength(11);
  const third = rows()[2]!;
  expect(third.getAttribute("aria-posinset")).toBe("3");
  expect(third.getAttribute("aria-setsize")).toBe("100");
  expect(third.style.position).toBe("absolute");
  expect(third.style.transform).toBe("translateY(100px)");
  expect(third.style.height).toBe("50px");
  expect(renders).toBe(11);

  // State inside a row, then a refetch: new objects with the same ids keep every row.
  third.querySelector("button")!.click();
  flush();
  items.set(people(100, " (new)"));
  flush();
  expect(rows()[2]).toBe(third);
  expect(third.textContent).toBe("2. Person 2 (new): 1");
  expect(renders).toBe(11);

  // A record moved to another index keeps its row, which shows its new index and place.
  items.set([people(1, "!")[0]!, ...people(100, " (new)").slice(3)]);
  flush();
  expect(third.isConnected).toBe(false);
  const moved = rows().find((li) => li.textContent!.startsWith("1. Person 3"));
  expect(moved?.getAttribute("aria-posinset")).toBe("2");
  expect(moved?.style.transform).toBe("translateY(50px)");
});

it("VirtualList measures its rows with `measure`, and hands out its virtualizer", () => {
  let list!: Virtualizer;
  const root = mount(() => (
    <VirtualList
      class="box"
      items={people(100)}
      itemKey={(person) => person.id}
      size={50}
      measure
      virtualizer={(v) => (list = v)}
    >
      {(row) => row.item.name}
    </VirtualList>
  ));
  const rows = [...root.querySelectorAll("li")];
  expect(rows[0]!.style.height).toBe("");
  observerOf(rows[0]!)!.fire(rows, 30);
  flush();
  expect(list.start(3)).toBe(90);
  expect(rows[3]!.style.transform).toBe("translateY(90px)");
});

it("VirtualGrid fits columns, places its cells, and measures a row as its tallest cell", () => {
  const root = mount(() => (
    <VirtualGrid
      class="box"
      items={people(50)}
      itemKey={(person) => person.id}
      minItemWidth={100}
      gap={10}
      size={120}
      measure
      overscan={0}
      itemProps={(person) => ({ "data-id": person.id })}
    >
      {(cell) => <span>{cell.item.name}</span>}
    </VirtualGrid>
  ));
  const cells = () => [...root.querySelectorAll("li")];
  // 600px fit 5 columns of 112px with 10px gaps; [-100, 400] holds rows 0 to 3.
  expect(cells()).toHaveLength(20);
  const seventh = cells()[6]!;
  expect(seventh.getAttribute("data-id")).toBe("p6");
  expect(seventh.getAttribute("data-row")).toBe("1");
  expect(seventh.style.width).toBe("112px");
  expect(seventh.style.transform).toBe("translate(122px, 130px)");

  // Row 0's cells measure 80 to 104px: the row is 104px tall.
  const first: Element[] = cells().slice(0, 5);
  observerOf(first[0]!)!.fire(cells(), (cell) =>
    first.includes(cell) ? 80 + first.indexOf(cell) * 6 : 120,
  );
  flush();
  expect(seventh.style.transform).toBe("translate(122px, 114px)");

  // Narrower: 3 columns, the measured sizes start over.
  box.width = 330;
  for (const observer of [observerOf(root.querySelector("ul")!)!]) observer.fire([], 0);
  window.dispatchEvent(new Event("resize"));
  frame();
  expect(seventh.getAttribute("data-row")).toBe("2");
  expect(seventh.style.transform).toBe("translate(0px, 260px)");
});

it("VirtualTable renders its window between spacer rows, with the table's row count and indexes", () => {
  const scroller = document.createElement("div");
  scroller.getBoundingClientRect = () => ({ top: 50 }) as DOMRect;
  Object.defineProperty(scroller, "clientHeight", { value: 200 });
  const items = signal(people(1000));
  const root = mount(() => (
    <VirtualTable
      aria-label="People"
      items={items()}
      itemKey={(person) => person.id}
      size={20}
      overscan={0}
      scroller={() => scroller}
      colSpan={2}
      head={
        <thead>
          <tr aria-rowindex={1}>
            <th scope="col">Name</th>
            <th scope="col">Id</th>
          </tr>
        </thead>
      }
      empty={
        <tr>
          <td colspan={2}>Nobody</td>
        </tr>
      }
      rowProps={(person) => ({ "data-id": person.id })}
    >
      {(row) => (
        <>
          <td>{row.item.name}</td>
          <td>{row.item.id}</td>
        </>
      )}
    </VirtualTable>
  ));
  const table = root.querySelector("table")!;
  const body = table.querySelector("tbody")!;
  body.classList.add("box");
  box.top = 50 + 40 - 1000;
  scroller.dispatchEvent(new Event("scroll"));
  frame();
  const rows = [...body.querySelectorAll("tr[data-row]")];
  expect(table.getAttribute("aria-rowcount")).toBe("1001");
  expect(table.getAttribute("aria-label")).toBe("People");
  // [960, 1160] from the body's top: rows 48 to 58.
  expect(rows.map((tr) => tr.getAttribute("aria-rowindex"))).toEqual(
    Array.from({ length: 11 }, (_, i) => String(48 + i + 2)),
  );
  expect(rows[0]!.getAttribute("data-id")).toBe("p48");
  expect(rows[0]!.children).toHaveLength(2);
  const spacers = [...body.querySelectorAll<HTMLElement>("tr[data-spacer]")];
  expect(spacers.map((tr) => tr.getAttribute("aria-hidden"))).toEqual(["true", "true"]);
  expect(spacers.map((tr) => (tr.firstElementChild as HTMLElement).style.height)).toEqual([
    "960px",
    `${(1000 - 59) * 20}px`,
  ]);
  expect(spacers[0]!.firstElementChild!.getAttribute("colspan")).toBe("2");

  items.set([]);
  flush();
  expect(table.getAttribute("aria-rowcount")).toBe("1");
  expect(body.textContent).toBe("Nobody");
});
