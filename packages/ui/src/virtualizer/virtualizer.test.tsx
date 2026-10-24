// The virtualizer on the server (TASK-565): it reads nothing from the browser and renders the first
// `initial` items, in whole rows of its columns, so hydration renders the same HTML.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { createVirtualizer, type VirtualizerOptions } from "./virtualizer.ts";

function Grid(props: { options: VirtualizerOptions }) {
  const v = createVirtualizer(props.options);
  return (
    <ul data-mounted={String(v.mounted())} data-total={v.total()} data-after={v.after()}>
      {v.items().map((i) => (
        <li key={i} aria-posinset={i + 1}>
          {i}
        </li>
      ))}
    </ul>
  );
}

const items = (html: string) =>
  [...html.matchAll(/<li[^>]*>(\d+)<\/li>/g)].map((m) => Number(m[1]));

describe("createVirtualizer on the server", () => {
  it("renders nothing without `initial`", async () => {
    const html = await renderToString(() => <Grid options={{ count: 100, size: 40 }} />);
    expect(items(html)).toEqual([]);
    expect(html).toContain('data-mounted="false"');
    expect(html).toContain('data-total="4000"');
  });

  it("renders the first `initial` items, in whole rows, never past the count", async () => {
    const list = await renderToString(() => (
      <Grid options={{ count: 100, size: 40, initial: 5 }} />
    ));
    expect(items(list)).toEqual([0, 1, 2, 3, 4]);
    expect(list).toContain(`data-after="${4000 - 5 * 40}"`);

    // Before it measures a width, `{ minWidth }` columns are `min`: 3 here, so 7 items take 3 rows.
    const grid = await renderToString(() => (
      <Grid
        options={{ count: 8, size: 40, gap: 8, initial: 7, columns: { minWidth: 96, min: 3 } }}
      />
    ));
    expect(items(grid)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(grid).toContain(`data-total="${3 * 40 + 2 * 8}"`);
  });
});
