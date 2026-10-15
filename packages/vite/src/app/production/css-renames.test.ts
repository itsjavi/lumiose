// Following the stylesheets another plugin renamed after the CSS manifest recorded them (TASK-342).
import { describe, expect, it } from "vitest";
import { cssRenames, type CssSnapshot } from "./css-renames.ts";

/** A snapshot from `{ file: name }` assets and `{ chunk: [css…] }` chunks. */
const snapshot = (
  assets: Record<string, string>,
  chunks: Record<string, string[]> = {},
): CssSnapshot => ({
  assets: new Map(Object.entries(assets).map(([file, name]) => [file, [name]])),
  chunks: new Map(Object.entries(chunks)),
});

describe("cssRenames()", () => {
  it("follows the files a chunk now imports instead, in order", () => {
    const before = snapshot(
      { "a-1.css": "a.css", "b-1.css": "b.css", "c-1.css": "c.css" },
      { "island.js": ["a-1.css", "b-1.css", "c-1.css"] },
    );
    const after = snapshot(
      { "x-2.css": "x.css", "b-1.css": "b.css", "y-2.css": "y.css" },
      { "island.js": ["x-2.css", "b-1.css", "y-2.css"] },
    );
    expect(cssRenames(before, after)).toEqual(
      new Map([
        ["a-1.css", "x-2.css"],
        ["c-1.css", "y-2.css"],
      ]),
    );
  });

  it("follows a file re-emitted under its own name, as StyleX re-emits one", () => {
    const before = snapshot({ "app-1.css": "app.css", "page-1.css": "page.css" });
    const after = snapshot({
      "app-2.css": "app.css",
      "page-2.css": "page.css",
      "new-1.css": "new.css",
    });
    expect(cssRenames(before, after)).toEqual(
      new Map([
        ["app-1.css", "app-2.css"],
        ["page-1.css", "page-2.css"],
      ]),
    );
  });

  it("follows a file to the one CSS file added, and leaves out what nothing explains", () => {
    expect(
      cssRenames(snapshot({ "app-1.css": "app.css" }), snapshot({ "merged-1.css": "merged.css" })),
    ).toEqual(new Map([["app-1.css", "merged-1.css"]]));
    const before = snapshot({ "a-1.css": "a.css", "b-1.css": "b.css" });
    const after = snapshot({ "x-1.css": "x.css", "y-1.css": "y.css" });
    expect(cssRenames(before, after)).toEqual(new Map());
    // Unchanged output: nothing to follow.
    expect(cssRenames(before, before)).toEqual(new Map());
  });
});
