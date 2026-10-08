import { describe, expect, it } from "vitest";
import { escapeXml, formatDate, rssDate, tagLabel } from "./format.ts";
import { pageCount, paginate, pageHref } from "./paginate.ts";
import { searchEntries, type SearchEntry } from "./search.ts";

describe("pagination", () => {
  const items = Array.from({ length: 10 }, (_, index) => index);

  it("splits items into pages", () => {
    expect(pageCount(10, 4)).toBe(3);
    expect(pageCount(0, 4)).toBe(1);
    expect(paginate(items, 4, 1)).toEqual({ number: 1, count: 3, items: [0, 1, 2, 3] });
    expect(paginate(items, 4, 3)).toEqual({ number: 3, count: 3, items: [8, 9] });
    expect(paginate(items, 4, 4)).toBeUndefined();
    expect(paginate(items, 4, 0)).toBeUndefined();
    expect(paginate(items, 4, 1.5)).toBeUndefined();
  });

  it("links page 1 to the home page", () => {
    expect(pageHref(1)).toBe("/");
    expect(pageHref(2)).toBe("/page/2");
  });
});

describe("formatting", () => {
  it("formats calendar days in UTC", () => {
    expect(formatDate("2026-09-18")).toBe("18 September 2026");
    expect(rssDate("2026-09-18")).toBe("Fri, 18 Sep 2026 00:00:00 GMT");
  });

  it("labels tags and escapes XML", () => {
    expect(tagLabel("slow-travel")).toBe("Slow travel");
    expect(escapeXml(`Fish & "chips" <'here'>`)).toBe(
      "Fish &amp; &quot;chips&quot; &lt;&apos;here&apos;&gt;",
    );
  });
});

function entry(title: string, tags: string[], summary: string, date: string): SearchEntry {
  return { url: `/posts/${date}`, title, tags, summary, date };
}

describe("searchEntries", () => {
  const entries = [
    entry(
      "Lofoten in February",
      ["islands", "winter"],
      "Northern lights over the harbour.",
      "2026-02-14",
    ),
    entry(
      "Market mornings in Oaxaca",
      ["food", "cities"],
      "Hot chocolate and grills.",
      "2026-06-21",
    ),
    entry(
      "Walking the Isle of Skye",
      ["islands", "hiking"],
      "Ridges and sea cliffs.",
      "2025-09-07",
    ),
  ];

  it("matches every word in titles, tags and summaries, title matches first", () => {
    expect(searchEntries(entries, "ISLANDS").map((e) => e.title)).toEqual([
      "Lofoten in February",
      "Walking the Isle of Skye",
    ]);
    expect(searchEntries(entries, "skye islands").map((e) => e.title)).toEqual([
      "Walking the Isle of Skye",
    ]);
    expect(searchEntries(entries, "harbour").map((e) => e.title)).toEqual(["Lofoten in February"]);
    expect(searchEntries(entries, "oaxaca islands")).toEqual([]);
  });

  it("ignores case and accents, and limits the results", () => {
    expect(searchEntries(entries, "Oáxaca")).toHaveLength(1);
    expect(searchEntries(entries, "  ")).toEqual([]);
    expect(searchEntries(entries, "i", 2)).toHaveLength(2);
  });
});
