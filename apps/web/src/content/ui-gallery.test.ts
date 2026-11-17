// The /ui gallery and the component page layout (TASK-614): every component @lumiose/ui exports has
// a cell with a live demo, and every component page yields its usage and props.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findUiPage, uiPages } from "./docs.ts";
import { componentLayout, firstDemo, isComponentPage, uiGallery } from "./ui-gallery.ts";

/** The component entries of @lumiose/ui (`@lumiose/ui/dialog`): its exports that are modules. */
function componentEntries(): string[] {
  const manifest: unknown = JSON.parse(
    readFileSync(new URL("../../../../packages/ui/package.json", import.meta.url), "utf8"),
  );
  if (typeof manifest !== "object" || manifest === null || !("exports" in manifest)) return [];
  return Object.keys(manifest.exports ?? {})
    .filter((entry) => /^\.\/[a-z-]+$/.test(entry))
    .map((entry) => entry.slice(2));
}

describe("the /ui gallery", () => {
  const cells = uiGallery();
  const paths = cells.map((cell) => cell.page.path);

  it("has a cell for every component @lumiose/ui exports", () => {
    // The virtualizer is the headless primitive under the three virtual components: a guide.
    const entries = componentEntries().filter((entry) => entry !== "virtualizer");
    expect(entries.length).toBeGreaterThan(30);
    expect(entries.filter((entry) => !paths.includes(entry))).toEqual([]);
    // …and for every page of the Components section, in its order.
    expect(paths).toEqual(
      uiPages()
        .filter(isComponentPage)
        .map((page) => page.path),
    );
    expect(paths).toContain("virtual-list");
    expect(paths).not.toContain("installation");
  });

  it("runs the first live demo of each page, once", () => {
    for (const cell of cells) {
      expect(cell.demo).toEqual(firstDemo(cell.page));
      expect(cell.demo.id.startsWith(`${cell.page.path}-`), cell.demo.id).toBe(true);
    }
    expect(new Set(cells.map((cell) => cell.demo.id)).size).toBe(cells.length);
    expect(cells.find((cell) => cell.page.path === "dialog")!.demo).toEqual({
      id: "dialog-1",
      island: false,
    });
  });
});

describe("a component page's layout", () => {
  it("leads with the demo, the usage and the props of the first part", () => {
    const tabs = componentLayout(findUiPage("tabs")!);
    expect(tabs.demo?.id).toBe("tabs-1");
    expect(tabs.usage).toContain('import { Tabs } from "@lumiose/ui";');
    expect(tabs.usage).toContain("<Tabs.Root>\n  <Tabs.List>");
    expect(tabs.props?.part).toBe("Tabs.Root");
    expect(tabs.props?.html).toContain("<code>defaultValue</code>");
    expect(tabs.props?.html).not.toContain("activateOnFocus");
  });

  it("moves the usage out of the body and keeps everything else", () => {
    const page = findUiPage("tabs")!;
    const { blocks } = componentLayout(page);
    expect(page.blocks.length - blocks.length).toBe(2);
    expect(blocks.every((block) => page.blocks.includes(block))).toBe(true);
    const html = blocks.flatMap((block) => (block.kind === "html" ? [block.html] : [])).join("");
    for (const heading of page.headings) expect(html).toContain(`id="${heading.id}"`);
  });

  it("finds usage and props on every component page", () => {
    const missing = uiGallery().flatMap(({ page }) => {
      const layout = componentLayout(page);
      return layout.usage === undefined || layout.props === undefined || layout.demo === undefined
        ? [page.path]
        : [];
    });
    expect(missing).toEqual([]);
  });
});
