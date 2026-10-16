// Server HTML of Separator (TASK-374): a native `<hr>`, horizontal by default, with
// `data-orientation`; a vertical one adds `aria-orientation`.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { attrs } from "../test/html.ts";
import { Separator } from "./separator.tsx";

describe("Separator on the server", () => {
  it("renders an hr, horizontal by default, without a redundant aria-orientation", async () => {
    const html = await renderToString(() => <Separator class="line" />);
    expect(attrs(html, "hr")).toEqual({ class: "line", "data-orientation": "horizontal" });
  });

  it("marks a vertical separator for assistive technology and for CSS", async () => {
    const html = await renderToString(() => <Separator orientation="vertical" />);
    expect(attrs(html, "hr")).toEqual({
      "aria-orientation": "vertical",
      "data-orientation": "vertical",
    });
  });
});
