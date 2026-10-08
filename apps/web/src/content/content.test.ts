// The website's content layer: docs rendering and links, the benchmark evidence, llms.txt, search
// and the compiled samples shown on the landing page.
import { describe, expect, it } from "vitest";
import { searchDocs, type SearchEntry } from "../lib/search.ts";
import { docHref, docNav, docPages, findDoc, readOutline, slugify } from "./docs.ts";
import { evidence } from "./evidence.ts";
import { llmsText } from "./llms.ts";
import { COUNTER_FILE, counterCss, counterOutput, counterSource } from "./samples.ts";

const binding = await import("@lumen/compiler").catch(() => undefined);

describe("docs", () => {
  it("rewrites links between Markdown files to page URLs", () => {
    expect(docHref("../errors/LUM1001.md", "concepts/compiler")).toBe("/docs/errors/LUM1001");
    expect(docHref("reference/jsx.md#imports", "README")).toBe("/docs/reference/jsx#imports");
    expect(docHref("errors/README.md", "README")).toBe("/docs/errors");
    expect(docHref("../README.md", "concepts/jsx")).toBe("/docs");
    expect(docHref("https://example.com/a.md", "README")).toBe("https://example.com/a.md");
    expect(docHref("#concept", "README")).toBe("#concept");
  });

  it("makes GitHub-style heading anchors", () => {
    expect(slugify("Imports outside `src/` and `.stsx` from other packages")).toBe(
      "imports-outside-src-and-stsx-from-other-packages",
    );
    expect(slugify("lumen check")).toBe("lumen-check");
  });

  it("orders pages by the index, then the diagnostics", () => {
    const pages = docPages();
    expect(pages[0]).toMatchObject({ topic: "README", path: "", title: "Lumen docs" });
    expect(pages[1]?.topic).toBe("getting-started");
    expect(docNav().map((section) => section.title)).toEqual([
      "Start here",
      "Concepts",
      "Reference",
      "Diagnostics",
    ]);
    expect(findDoc("errors/LUM2001")?.title).toBe("LUM2001: Stale derived value");
    expect(findDoc("/concepts/styles/")?.summary).toMatch(/^Write plain CSS/);
    expect(readOutline("## A\n\n- [One](one.md): x\n")).toEqual([
      { title: "A", entries: [{ topic: "one", label: "One" }] },
    ]);
  });

  it("links only to pages and anchors that exist", () => {
    const broken: string[] = [];
    for (const page of docPages()) {
      const html = page.blocks.map((block) => (block.kind === "html" ? block.html : "")).join("");
      for (const [, href] of html.matchAll(/href="(\/docs[^"]*)"/g)) {
        const [path, hash] = href!.slice("/docs".length).split("#");
        const target = findDoc(path!);
        const anchored =
          hash === undefined || target?.headings.some((heading) => heading.id === hash);
        if (target === undefined || !anchored) broken.push(`${page.topic} → ${href}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("serves llms.txt with links to the site's pages", () => {
    const text = llmsText();
    expect(text).toContain("[Signals and reactivity](/docs/concepts/signals)");
    expect(text).not.toMatch(/\]\([^)]+\.md\)/);
  });
});

describe("evidence", () => {
  it("reads every chart from the committed benchmark results", () => {
    const results = evidence();
    for (const bars of [results.cpu, results.size, results.firstPaint, results.ssr]) {
      expect(bars.filter((bar) => bar.self)).toHaveLength(1);
      expect(bars.every((bar) => bar.value > 0)).toBe(true);
    }
    expect(results.cpu.map((bar) => bar.label)).toContain("Solid");
    expect(results.ssr.map((bar) => bar.label)).toContain("React");
    expect(results.clientRun).toMatch(/Chrome/);
    expect(results.serverRun).toMatch(/Node/);
  });
});

describe("search", () => {
  const entries: SearchEntry[] = docPages().map((page) => ({
    url: page.url,
    title: page.title,
    section: page.section,
    summary: page.summary,
    headings: page.headings.map((heading) => [heading.id, heading.text]),
    text: page.text,
  }));

  it("ranks title matches first and needs every term", () => {
    expect(searchDocs(entries, "styles")[0]?.title).toBe("Styles");
    expect(searchDocs(entries, "staticPaths").map((result) => result.title)).toContain(
      "Rendering modes",
    );
    expect(searchDocs(entries, "styles zzzz")).toEqual([]);
  });
});

describe.skipIf(!binding)("landing page samples", () => {
  it("show what this compiler produces for the Counter", () => {
    const result = binding!.compile(counterSource, COUNTER_FILE, {
      target: "client",
      root: "/app",
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.css).toBe(counterCss);
    expect(result.code.replace(/\n\/\/# sourceMappingURL=.*$/s, "")).toBe(counterOutput);
  });
});
