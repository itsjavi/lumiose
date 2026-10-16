// Server HTML of Scroll Area (TASK-384): a focusable viewport that scrolls natively, aria-hidden
// custom scrollbars with their orientation and thumbs, and a corner hidden until both axes
// overflow.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { attrs } from "../test/html.ts";
import { ScrollArea } from "./scroll-area.tsx";

describe("ScrollArea on the server", () => {
  it("renders the viewport, the content, both scrollbars and the corner", async () => {
    const html = await renderToString(() => (
      <ScrollArea.Root overflowEdgeThreshold={8} class="area">
        <ScrollArea.Viewport aria-label="Notes" role="region">
          <ScrollArea.Content>Text</ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar>
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
        <ScrollArea.Scrollbar orientation="horizontal" keepMounted>
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
        <ScrollArea.Corner />
      </ScrollArea.Root>
    ));
    expect(attrs(html, "lu-scroll-area")).toEqual({
      class: "area",
      "overflow-edge-threshold": "8",
    });
    expect(attrs(html, "div")).toEqual({
      tabindex: "0",
      "aria-label": "Notes",
      role: "region",
      "data-viewport": "",
    });
    expect(attrs(html, "div", (a) => a["data-orientation"] === "vertical")).toEqual({
      "aria-hidden": "true",
      "data-scrollbar": "",
      "data-orientation": "vertical",
    });
    expect(attrs(html, "div", (a) => a["data-orientation"] === "horizontal")).toMatchObject({
      "data-keep-mounted": "",
    });
    expect(attrs(html, "div", (a) => "data-thumb" in a)).toEqual({ "data-thumb": "" });
    expect(attrs(html, "div", (a) => "data-corner" in a)).toEqual({
      "data-corner": "",
      hidden: "",
    });
  });
});
