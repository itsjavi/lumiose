// The head helpers of PageMeta (TASK-597): canonical URLs and meta descriptions.
import { describe, expect, it } from "vitest";
import { canonicalUrl, metaDescription, ogImages, absoluteUrl } from "./site.ts";

describe("canonicalUrl", () => {
  it("is the lumiose.dev URL, with the trailing slash GitHub Pages redirects to", () => {
    expect(canonicalUrl("/")).toBe("https://lumiose.dev/");
    expect(canonicalUrl("/docs/concepts/signals")).toBe(
      "https://lumiose.dev/docs/concepts/signals/",
    );
    expect(canonicalUrl("/ui/")).toBe("https://lumiose.dev/ui/");
    expect(canonicalUrl("/llms.txt")).toBe("https://lumiose.dev/llms.txt");
  });

  it("makes the Open Graph images absolute", () => {
    expect(absoluteUrl(ogImages.stsx.path)).toBe("https://lumiose.dev/og/stsx.png");
  });
});

describe("metaDescription", () => {
  it("keeps a description of 160 characters or fewer", () => {
    expect(metaDescription("  A short\n description.  ")).toBe("A short description.");
  });

  it("keeps whole sentences when enough of them fit", () => {
    const first = `${"Signals hold state and re-run only what read them".padEnd(120, " x")}.`;
    const text = `${first} A second sentence that does not fit in the description at all, so it goes.`;
    expect(metaDescription(text)).toBe(first);
  });

  it("cuts at a word with an ellipsis when the first sentence is too long", () => {
    const text = `A modal dialog: ${"a native <dialog> opened by invoker commands, ".repeat(5)}done.`;
    const description = metaDescription(text);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toMatch(/\w…$/);
    expect(text.startsWith(description.slice(0, -1))).toBe(true);
  });

  it("does not treat a dot inside a word as a sentence end", () => {
    const text = `STSX: .stsx files are TSX with style blocks, ${"scoped by placement and compiled ".repeat(4)}at build time.`;
    expect(metaDescription(text).startsWith("STSX: .stsx files")).toBe(true);
  });
});
