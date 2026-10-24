// VirtualList, VirtualGrid and VirtualTable on the server (TASK-565): the first `initial` items in
// flow, with their ARIA and keys' content, the list's and the table's rest of the height reserved,
// no placement before mount, and the table's empty row.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { attrs } from "../test/html.ts";
import { VirtualGrid, VirtualList, VirtualTable } from "./virtual.tsx";

const people = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Person ${i}` }));

describe("the virtualizer's components on the server", () => {
  it("VirtualList renders its first items in flow, and reserves the rest of its height", async () => {
    const html = await renderToString(() => (
      <VirtualList
        class="people"
        aria-label="People"
        items={people(100)}
        itemKey={(person) => person.id}
        size={40}
        initial={3}
        itemProps={(person) => ({ "data-id": person.id })}
      >
        {(row) => (
          <span>
            {row.index}: {row.item.name}
          </span>
        )}
      </VirtualList>
    ));
    expect(attrs(html, "ul")).toEqual({
      class: "people",
      "aria-label": "People",
      style: `padding-block-end:${97 * 40}px`,
    });
    expect([...html.matchAll(/<li\b/g)]).toHaveLength(3);
    expect(attrs(html, "li")).toEqual({
      "data-id": "p0",
      "data-row": "0",
      "aria-setsize": "100",
      "aria-posinset": "1",
      style: "height:40px",
    });
    expect(html).toContain("<span>2: Person 2</span>");
  });

  it("VirtualGrid renders its first items unplaced, in the page's style or CSS", async () => {
    const html = await renderToString(() => (
      <VirtualGrid
        style={{ display: "grid" }}
        items={people(50)}
        itemKey={(person) => person.id}
        minItemWidth={96}
        minColumns={2}
        size={120}
        initial={5}
      >
        {(cell) => cell.item.name}
      </VirtualGrid>
    ));
    expect(attrs(html, "ul")).toEqual({ style: "display:grid" });
    // 5 items in rows of `minColumns` (2) make 3 rows: 6 items.
    expect([...html.matchAll(/<li\b/g)]).toHaveLength(6);
    expect(attrs(html, "li", (a) => a["aria-posinset"] === "6")).toEqual({
      "data-row": "2",
      "aria-setsize": "50",
      "aria-posinset": "6",
    });
  });

  it("VirtualTable renders its head, its first rows and a spacer for the rest", async () => {
    const html = await renderToString(() => (
      <VirtualTable
        aria-label="People"
        items={people(1000)}
        itemKey={(person) => person.id}
        size={20}
        initial={2}
        colSpan={2}
        head={
          <thead>
            <tr aria-rowindex={1}>
              <th scope="col">Name</th>
            </tr>
          </thead>
        }
      >
        {(row) => <td>{row.item.name}</td>}
      </VirtualTable>
    ));
    expect(attrs(html, "table")).toEqual({ "aria-label": "People", "aria-rowcount": "1001" });
    expect(attrs(html, "tr", (a) => a["data-row"] === "1")).toEqual({
      "data-row": "1",
      "aria-rowindex": "3",
    });
    expect(attrs(html, "tr", (a) => "data-spacer" in a)).toEqual({
      "aria-hidden": "true",
      "data-spacer": "",
    });
    expect(attrs(html, "td", (a) => "colspan" in a)).toEqual({
      colspan: "2",
      style: `padding:0;border:0;height:${998 * 20}px`,
    });

    const empty = await renderToString(() => (
      <VirtualTable
        items={[] as { id: string }[]}
        itemKey={(item) => item.id}
        size={20}
        empty={
          <tr>
            <td>Nobody</td>
          </tr>
        }
      >
        {() => <td />}
      </VirtualTable>
    ));
    expect(empty).toContain("<td>Nobody</td>");
    expect(empty).not.toContain("data-spacer");
  });
});
