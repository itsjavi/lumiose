// The website's content layer: docs rendering and links, the benchmark evidence, llms.txt, search
// and the compiled samples shown on the landing page.
import { describe, expect, it } from "vitest";
import { searchDocs, type SearchEntry } from "../lib/search.ts";
import { docHref, docNav, docPages, findDoc, readOutline, slugify } from "./docs.ts";
import { evidence, readFullstack, type FullstackRun } from "./evidence.ts";
import { COLUMNS, factor, kilobytes, readStacks, stacks } from "./stacks.ts";
import { llmsText } from "./llms.ts";
import { FILENAME, ROOT } from "../playground/compiler.ts";
import { counterCss, counterOutput, counterSource } from "./samples.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);

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
    expect(slugify("lumiose check")).toBe("lumiose-check");
  });

  it("orders pages by the index, then the diagnostics", () => {
    const pages = docPages();
    expect(pages[0]).toMatchObject({ topic: "README", path: "", title: "Lumiose docs" });
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

/** A fullstack results file with only Lumiose's home page payload (when measured). */
function run(date: string, quick: boolean, bytes?: number): FullstackRun {
  return {
    meta: { date, quick, node: "v26", machine: { cpu: "M1", cores: 8, os: "macOS" } },
    results: {
      lumiose: bytes === undefined ? {} : { "payload.home.js-brotli": { median: bytes } },
    },
  };
}

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

  it("reads the JavaScript of a server page from the newest full fullstack run", () => {
    const results = evidence();
    expect(results.serverJs.map((bar) => bar.label)).toEqual(
      expect.arrayContaining(["Lumiose", "React Router", "Next.js"]),
    );
    expect(results.serverJsByApp["lumiose"]).toBe(0);
    expect(results.serverJsByApp["next"]).toBeGreaterThan(50);
    expect(results.fullstackRun).toMatch(/^\d{4}-\d{2}-\d{2} · .+ · Node \d/);

    // A newer quick run and a newer run without payloads lose to the newest full one.
    const picked = readFullstack([
      run("2026-01-01", false, 1000),
      run("2026-01-03", true, 3000),
      run("2026-01-02", false, 2000),
      run("2026-01-04", false),
    ]);
    expect(picked.serverJsByApp).toEqual({ lumiose: 2 });
  });
});

describe("stack table", () => {
  it("fills every measured cell from the committed results, and shows 'measuring' for the rest", () => {
    const rows = stacks();
    expect(rows.map((row) => row.stack)).toEqual([
      "React + Next.js",
      "React Router",
      "Solid + SolidStart",
      "Svelte + SvelteKit",
      "Vue + Nuxt",
      "Preact",
      "Remix 3",
      "Astro",
      "Lumiose",
    ]);
    const results = evidence();
    const lumiose = rows.find((row) => row.self)!;
    expect(lumiose.serverJs).toEqual({ kind: "measured", text: "0 kB" });
    expect(lumiose.clientSpeed).toEqual({
      kind: "measured",
      text: factor(results.cpuByColumn["lumiose"]!),
    });
    const next = rows.find((row) => row.stack === "React + Next.js")!;
    expect(next.serverJs).toEqual({
      kind: "measured",
      text: kilobytes(results.serverJsByApp["next"]!),
    });
    // Astro is shown honestly: 0 kB too, and its islands need a second UI framework.
    const astro = rows.find((row) => row.stack === "Astro")!;
    expect(astro.serverJs).toMatchObject({ text: "0 kB" });
    expect(astro.sameComponents).toMatchObject({ tone: "no" });
    // No cell says "not measured": unmeasured cells are "measuring" until TASK-235.
    const cells = rows.flatMap((row) =>
      Object.keys(COLUMNS)
        .slice(1)
        .map((key) => row[key as keyof typeof COLUMNS]),
    );
    expect(JSON.stringify(cells)).not.toMatch(/not measured/i);
  });

  it("fills a 'measuring' cell as soon as its results are committed", () => {
    const rows = readStacks({
      cpuByColumn: { vue: 1.1, lumiose: 1.05 },
      serverJsByApp: { nuxt: 54.3, lumiose: 0 },
    });
    const vue = rows.find((row) => row.stack === "Vue + Nuxt")!;
    expect(vue.serverJs).toEqual({ kind: "measured", text: "54 kB" });
    expect(vue.clientSpeed).toEqual({ kind: "measured", text: "1.10×" });
    expect(rows.find((row) => row.stack === "Solid + SolidStart")!.clientSpeed).toEqual({
      kind: "measuring",
    });
    expect(kilobytes(6.46)).toBe("6.5 kB");
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
  it("show what this compiler produces for the Counter, as the playground compiles it", () => {
    const result = binding!.compile(counterSource, FILENAME, {
      target: "client",
      root: ROOT,
      sourceMap: false,
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.css).toBe(counterCss);
    expect(result.code).toBe(counterOutput);
  });
});
