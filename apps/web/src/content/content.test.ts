// The website's content layer: docs rendering and links, the benchmark evidence, llms.txt, search
// and the compiled samples shown on the landing page.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { searchDocs, type SearchEntry } from "../lib/search.ts";
import { site } from "../lib/site.ts";
import {
  docHref,
  docNav,
  docPages,
  findDoc,
  findUiPage,
  readOutline,
  slugify,
  uiNav,
  uiPages,
} from "./docs.ts";
import { schemeStyle, themeProperties } from "./ui-theme.ts";
import { evidence, readFullstack, type FullstackRun } from "./evidence.ts";
import { factor, headlines, kilobytes, perSecond, readStacks, stacks } from "./stacks.ts";
import { llmsText, uiLlmsText } from "./llms.ts";
import { fillReadme, generateReadme, readmeRegions } from "./readme.ts";
import rootReadme from "../../../../README.md?raw";
import { FILENAME, ROOT } from "../playground/compiler.ts";
import { counterCss, counterOutput, counterSource } from "./samples.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);

/** The live demos of a UI page. */
function demos(path: string) {
  return findUiPage(path)!.blocks.flatMap((block) =>
    block.kind === "code" && block.demo ? [block.demo] : [],
  );
}

describe("docs", () => {
  it("rewrites links between Markdown files to page URLs", () => {
    expect(docHref("../errors/LUM1001.md", "concepts/compiler")).toBe("/docs/errors/LUM1001");
    expect(docHref("reference/jsx.md#imports", "README")).toBe("/docs/reference/jsx#imports");
    expect(docHref("errors/README.md", "README")).toBe("/docs/errors");
    expect(docHref("../README.md", "concepts/jsx")).toBe("/docs");
    expect(docHref("https://example.com/a.md", "README")).toBe("https://example.com/a.md");
    expect(docHref("#concept", "README")).toBe("#concept");
    // The UI pages (packages/ui/docs) link Lumiose's by their site URLs.
    expect(docHref("https://itsjavi.com/lumiose/docs/concepts/islands/", "ui/dialog")).toBe(
      "/docs/concepts/islands",
    );
    // …and are the /ui section (TASK-387), which Lumiose's pages link by its URL.
    expect(docHref("README.md#the-default-theme", "ui/dialog")).toBe("/ui#the-default-theme");
    expect(docHref("popover.md#popoverpopup", "ui/tooltip")).toBe("/ui/popover#popoverpopup");
    expect(docHref("https://itsjavi.com/lumiose/docs/ui/dialog/", "README")).toBe("/ui/dialog");
    expect(docHref("https://itsjavi.com/lumiose/ui/llms.txt", "README")).toBe("/ui/llms.txt");
    expect(docHref("https://itsjavi.com/lumiose/ui/tabs#styling", "README")).toBe(
      "/ui/tabs#styling",
    );
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
      "Coming from",
      "Concepts",
      "Guides",
      "UI",
      "Deploy",
      "Reference",
      "Diagnostics",
    ]);
    expect(findDoc("errors/LUM2001")?.title).toBe("LUM2001: Stale derived value");
    expect(findDoc("/concepts/styles/")?.summary).toMatch(/^Write plain CSS/);
    expect(readOutline("## A\n\n- [One](one.md): x\n")).toEqual([
      { title: "A", entries: [{ topic: "one", label: "One" }] },
    ]);
    // @lumiose/ui's pages fill the UI section (decision-64), at their /ui URLs (TASK-387), and
    // are not docs pages.
    const ui = docNav().find((section) => section.title === "UI")!.pages;
    expect(ui).toEqual(uiPages());
    expect(findDoc("ui/dialog")).toBeUndefined();
    expect(docPages().some((page) => page.topic.startsWith("ui/"))).toBe(false);
  });

  it("renders the /ui section from packages/ui/docs, in the order of its llms.txt", () => {
    const pages = uiPages();
    expect(pages[0]).toMatchObject({
      topic: "ui/README",
      path: "",
      url: "/ui",
      label: "Introduction",
    });
    expect(uiNav().map((section) => section.title)).toEqual(["Overview", "Components"]);
    expect(uiNav()[0]!.pages.map((page) => page.path)).toEqual(["", "installation", "theming"]);
    const components = uiNav().find((section) => section.title === "Components")!.pages;
    for (const name of [
      "accordion",
      "collapsible",
      "context-menu",
      "dialog",
      "drawer",
      "menu",
      "popover",
      "tabs",
      "toast",
    ]) {
      expect(components.map((page) => page.path)).toContain(name);
    }
    expect(findUiPage("/dialog/")).toMatchObject({ title: "Dialog", url: "/ui/dialog" });
  });

  it("gives every UI component page a live demo, and islands where the example needs one", () => {
    for (const page of uiNav().find((section) => section.title === "Components")!.pages) {
      expect(demos(page.path).length, page.path).toBeGreaterThan(0);
    }
    expect(demos("dialog")).toEqual([
      { id: "dialog-1", island: false },
      { id: "dialog-2", island: true },
    ]);
  });

  it("shows the default theme's palette after the table of its properties", () => {
    const withPalette = uiPages().filter((page) =>
      page.blocks.some((block) => block.kind === "palette"),
    );
    expect(withPalette.map((page) => page.path)).toEqual(["theming"]);
    // Vitest stubs CSS imports, so the test reads the stylesheet itself.
    const css = readFileSync(
      new URL("../../../../packages/ui/src/themes/default.css", import.meta.url),
      "utf8",
    );
    const properties = themeProperties(css);
    expect(properties.find((property) => property.name === "--lu-background")).toEqual({
      name: "--lu-background",
      light: "#fff",
      dark: "#09090b",
    });
    expect(properties.find((property) => property.name === "--lu-primary")).toMatchObject({
      light: "#2563eb",
      dark: "#2563eb",
    });
    expect(schemeStyle("dark", properties)).toMatch(
      /^color-scheme: dark; --lu-background: #09090b;/,
    );
  });

  it("links only to pages and anchors that exist", () => {
    const broken: string[] = [];
    for (const page of [...docPages(), ...uiPages()]) {
      const html = page.blocks.map((block) => (block.kind === "html" ? block.html : "")).join("");
      for (const [, href, root] of html.matchAll(/href="(\/(docs|ui)(?:[/#][^"]*)?)"/g)) {
        if (href!.endsWith(".txt")) continue;
        const [path, hash] = href!.slice(root!.length + 1).split("#");
        const target = root === "ui" ? findUiPage(path!) : findDoc(path!);
        const anchored =
          hash === undefined || target?.headings.some((heading) => heading.id === hash);
        if (target === undefined || !anchored) broken.push(`${page.topic} → ${href}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("keeps the meta description within 160 characters, search terms first", () => {
    expect(site.description.length).toBeLessThanOrEqual(160);
    expect(site.description).toMatch(/static sites, server-side rendering, islands and SPAs/);
  });

  it("serves llms.txt with links to the site's pages", () => {
    const text = llmsText();
    expect(text).toContain("[Signals and reactivity](/docs/concepts/signals)");
    expect(text).not.toMatch(/\]\([^)]+\.md\)/);
    expect(text).toContain("](https://itsjavi.com/lumiose/ui/llms.txt)");
  });

  it("serves @lumiose/ui's llms.txt with links to its pages on the site", () => {
    const text = uiLlmsText();
    expect(text).toMatch(/^# Lumiose UI\n/);
    expect(text).toContain("[Dialog](/ui/dialog)");
    expect(text).not.toMatch(/\]\([^)]+\.md\)/);
  });
});

/** A fullstack results file with only Lumiose's home page payload and throughput (when measured). */
function run(date: string, quick: boolean, bytes?: number, rps?: number): FullstackRun {
  return {
    meta: { date, quick, node: "v26", machine: { cpu: "M1", cores: 8, os: "macOS" } },
    results: {
      lumiose: {
        ...(bytes === undefined ? {} : { "payload.home.js-brotli": { median: bytes } }),
        ...(rps === undefined ? {} : { "server.home.rps": { median: rps } }),
      },
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

  it("reads the request throughput from the newest full run that measured it", () => {
    expect(evidence().requestsByApp["lumiose"]).toBeGreaterThan(0);
    expect(evidence().requestsRun).toMatch(/^\d{4}-\d{2}-\d{2} · /);
    // Payloads and throughput may come from different runs.
    const picked = readFullstack([
      run("2026-01-01", false, 1000, 100),
      run("2026-01-02", false, undefined, 200),
      run("2026-01-03", true, 3000, 300),
    ]);
    expect(picked.serverJsByApp).toEqual({ lumiose: 1 });
    expect(picked.requestsByApp).toEqual({ lumiose: 200 });
    expect(picked.requestsRun).toMatch(/^2026-01-02 · /);
  });
});

/** The stack table with only server speed results. */
function pending(results: {
  rendersByFramework: Record<string, number>;
  requestsByApp: Record<string, number>;
  serverJsByApp?: Record<string, number>;
}) {
  return readStacks({ cpuByColumn: {}, serverJsByApp: {}, ...results });
}

describe("stack table", () => {
  it("fills every cell from the committed results", () => {
    const rows = stacks();
    // Lumiose first, then by npm downloads of each stack's main package.
    expect(rows.map((row) => row.stack)).toEqual([
      "Lumiose",
      "React + Next.js",
      "React Router",
      "Preact",
      "Astro",
      "Svelte + SvelteKit",
      "Vue + Nuxt",
      "Solid + SolidStart",
      "Remix 3",
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
    // Server speed: renders/s from the SSR benchmark (React's entry for both React rows), req/s
    // from the fullstack home page.
    expect(lumiose.rendering).toEqual({
      kind: "measured",
      text: perSecond(results.rendersByFramework["Lumiose"]!, "renders/s"),
    });
    expect(next.rendering).toEqual(rows.find((row) => row.stack === "React Router")!.rendering);
    expect(next.rendering).toMatchObject({ text: /^\d[\d,]* renders\/s$/ });
    expect(lumiose.requests).toMatchObject({ kind: "measured", text: /^\d[\d,]* req\/s$/ });
    const preact = rows.find((row) => row.stack === "Preact")!;
    expect(preact.requests).toEqual({ kind: "fact", text: "No full-stack layer" });
    // Astro's server-page JS is measured on its fullstack port (TASK-242), not claimed.
    const astro = rows.find((row) => row.stack === "Astro")!;
    expect(astro.serverJs.kind).toBe("measured");
    // React Router's framework mode is its full-stack layer.
    expect(rows.find((row) => row.stack === "React Router")!.fullStack).toEqual({
      kind: "fact",
      text: "Built in",
      tone: "yes",
    });
    const cells = rows.flatMap((row) => Object.values(row));
    expect(JSON.stringify(cells)).not.toMatch(/not measured/i);
    // TASK-235's run measured every cell: none is left "measuring".
    expect(cells).not.toContainEqual({ kind: "measuring" });
  });

  it("fills a 'measuring' cell as soon as its results are committed", () => {
    const rows = readStacks({
      cpuByColumn: { vue: 1.1, lumiose: 1.05 },
      serverJsByApp: { nuxt: 54.3, lumiose: 0 },
      rendersByFramework: {},
      requestsByApp: {},
    });
    const vue = rows.find((row) => row.stack === "Vue + Nuxt")!;
    expect(vue.serverJs).toEqual({ kind: "measured", text: "54 kB" });
    expect(vue.clientSpeed).toEqual({ kind: "measured", text: "1.10×" });
    expect(rows.find((row) => row.stack === "Solid + SolidStart")!.clientSpeed).toEqual({
      kind: "measuring",
    });
    expect(kilobytes(6.46)).toBe("6.5 kB");
  });

  it("maps the pending server speed sources, so committed results fill them", () => {
    const before = pending({ rendersByFramework: {}, requestsByApp: {} });
    for (const stack of ["Preact", "Astro", "Remix 3"]) {
      expect(before.find((row) => row.stack === stack)!.rendering).toEqual({ kind: "measuring" });
    }
    expect(before.find((row) => row.stack === "Astro")!.requests).toEqual({ kind: "measuring" });
    // The SSR entries of TASK-241 and the fullstack Astro app of TASK-242.
    const after = pending({
      rendersByFramework: { Preact: 310.4, Astro: 120, "Remix 3": 98.6 },
      requestsByApp: { astro: 1234.5 },
      serverJsByApp: { astro: 0 },
    });
    const row = (stack: string) => after.find((candidate) => candidate.stack === stack)!;
    expect(row("Preact").rendering).toEqual({ kind: "measured", text: "310 renders/s" });
    expect(row("Astro").rendering).toEqual({ kind: "measured", text: "120 renders/s" });
    expect(row("Remix 3").rendering).toEqual({ kind: "measured", text: "99 renders/s" });
    expect(row("Astro").requests).toEqual({ kind: "measured", text: "1,235 req/s" });
    expect(row("Astro").serverJs).toEqual({ kind: "measured", text: "0 kB" });
  });
});

describe("README numbers", () => {
  it("match the committed results", () => {
    expect(
      generateReadme(rootReadme),
      "README.md's generated numbers are stale: run `pnpm readme:gen`",
    ).toBe(rootReadme);
  });

  it("show the landing's headlines and every stack row", () => {
    const regions = readmeRegions(evidence(), stacks());
    for (const { value, label } of headlines(evidence())) {
      expect(regions.proof).toContain(`<strong>${value}</strong><br><sub>${label}</sub>`);
    }
    for (const row of stacks()) expect(regions.compare).toContain(row.stack);
    expect(regions.compare).toContain("<td><strong>Lumiose</strong></td>");
    expect(regions.compare).not.toMatch(/\n\s*\n/);
  });

  it("replace only the marked regions", () => {
    const readme = "intro\n<!-- generated:a -->\nold\n<!-- /generated:a -->\noutro\n";
    expect(fillReadme(readme, { a: "new" })).toBe(
      "intro\n<!-- generated:a -->\nnew\n<!-- /generated:a -->\noutro\n",
    );
    expect(() => fillReadme(readme, { b: "new" })).toThrow("<!-- generated:b -->");
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
