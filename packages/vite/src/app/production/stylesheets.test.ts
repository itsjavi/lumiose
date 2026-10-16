// How `lumiose build` groups pages' stylesheets into shared files (TASK-121, TASK-285).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { stylesheetTags } from "lumiose/internal/app/server/stylesheets.ts";
import { sharedRuns, styleTags } from "./stylesheets.ts";

/** Sizes by name: `big` stylesheets are 5 kB, the others 100 bytes. */
const bytes = (run: readonly string[]): number =>
  run.reduce((sum, href) => sum + (href.includes("big") ? 5000 : 100), 0);

describe("sharedRuns", () => {
  it("shares a group's run after the every-page one, though one page lacks it", () => {
    // The itsjavi.com port's shape: a fullscreen page outside the (site) group.
    const site = ["/doc.css", "/big-chrome.css", "/nav.css"];
    expect(
      sharedRuns(
        [
          [...site, "/home.css"],
          [...site, "/about.css"],
          [...site, "/blog.css"],
          ["/doc.css", "/editor.css"],
        ],
        bytes,
      ),
    ).toEqual({ shared: ["/doc.css"], groups: [["/big-chrome.css", "/nav.css"]] });
  });

  it("gives each group of three lists or more its own file, and none to smaller groups", () => {
    expect(
      sharedRuns(
        [
          ["/doc.css", "/big-site.css", "/a.css"],
          ["/doc.css", "/big-site.css", "/b.css"],
          ["/doc.css", "/big-site.css", "/c.css"],
          ["/doc.css", "/big-app.css", "/d.css"],
          ["/doc.css", "/big-app.css", "/e.css"],
          ["/doc.css", "/big-app.css", "/f.css"],
          // Two lists: sharing would save one download, for a request more on each page.
          ["/doc.css", "/big-pair.css", "/g.css"],
          ["/doc.css", "/big-pair.css", "/h.css"],
          ["/doc.css", "/big-alone.css"],
        ],
        bytes,
      ),
    ).toEqual({ shared: ["/doc.css"], groups: [["/big-site.css"], ["/big-app.css"]] });
  });

  it("leaves a run of 4 kB or less in the pages' own CSS, and tries its subgroups", () => {
    // `/small.css` follows `/doc.css` in four lists, but only three go on alike past 4 kB.
    expect(
      sharedRuns(
        [
          ["/doc.css", "/small.css", "/big-docs.css", "/a.css"],
          ["/doc.css", "/small.css", "/big-docs.css", "/b.css"],
          ["/doc.css", "/small.css", "/big-docs.css", "/c.css"],
          ["/doc.css", "/small.css", "/d.css"],
          ["/doc.css", "/editor.css"],
        ],
        bytes,
      ),
    ).toEqual({ shared: ["/doc.css"], groups: [["/small.css", "/big-docs.css"]] });
    expect(
      sharedRuns(
        [
          ["/doc.css", "/small.css", "/a.css"],
          ["/doc.css", "/small.css", "/b.css"],
          ["/doc.css", "/small.css", "/c.css"],
          ["/doc.css", "/editor.css"],
        ],
        bytes,
      ),
    ).toEqual({ shared: ["/doc.css"], groups: [] });
  });

  it("counts routes with the same stylesheets once", () => {
    const post = ["/doc.css", "/big-post.css"];
    expect(sharedRuns([post, post, post, ["/doc.css", "/editor.css"]], bytes)).toEqual({
      shared: ["/doc.css"],
      groups: [],
    });
  });

  it("shares groups without a run every page starts with, and everything of a single page", () => {
    expect(
      sharedRuns(
        [
          ["/big-site.css", "/a.css"],
          ["/big-site.css", "/b.css"],
          ["/big-site.css", "/c.css"],
          ["/editor.css"],
        ],
        bytes,
      ),
    ).toEqual({ groups: [["/big-site.css"]] });
    expect(sharedRuns([["/doc.css", "/page.css"]], bytes)).toEqual({
      shared: ["/doc.css", "/page.css"],
      groups: [],
    });
    expect(sharedRuns([[], []], bytes)).toEqual({ groups: [] });
  });
});

describe("styleTags", () => {
  const dirs: string[] = [];
  afterAll(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  });

  it("merges each shared run in cascade order, and gives every page all its CSS in order", async () => {
    const clientDir = mkdtempSync(join(tmpdir(), "lumiose-styles-"));
    dirs.push(clientDir);
    mkdirSync(join(clientDir, "assets"));
    const css: Record<string, string> = {
      doc: "html{margin:0}",
      header: `.header{color:navy}${".h{}".repeat(1100)}`,
      footer: ".footer{color:teal}",
      home: ".home{color:red}",
      about: ".about{color:blue}",
      post: `.post{color:green}${".p{}".repeat(1100)}`,
      editor: ".editor{color:gray}",
      missing: "",
    };
    for (const [name, text] of Object.entries(css)) {
      if (name !== "missing") writeFileSync(join(clientDir, "assets", `${name}.css`), text);
    }
    const url = (name: string): string => `/assets/${name}.css`;
    const site = ["doc", "header", "footer"].map(url);
    const home = [...site, url("home")];
    const about = [...site, url("about")];
    const post = [...site, url("post")];
    const editor = [url("doc"), url("editor")];
    const notFound = [...site, url("missing")];
    const written: string[] = [];
    const tags = await styleTags([home, about, post, editor], [notFound], {
      clientDir,
      base: "/",
      assetsDir: "assets",
      written: (fileName) => written.push(fileName),
    });

    // The every-page run is one stylesheet, linked as it is; the site group's run is merged.
    expect(tags.shared).toEqual({ href: url("doc"), covers: [url("doc")] });
    expect(tags.groups).toHaveLength(1);
    const group = tags.groups![0]!;
    expect(group.covers).toEqual([url("header"), url("footer")]);
    expect(group.href).toMatch(/^\/assets\/styles-[\w-]+\.css$/);
    expect(written).toContain(group.href.slice(1));
    expect(readFileSync(join(clientDir, group.href), "utf8")).toBe(
      `${css.header}\n${css.footer}\n`,
    );

    // Each page links the files that hold the start of its list, then its own CSS, so the
    // stylesheets it gets, in order, are its list: nothing more, nothing less.
    const order = (page: readonly string[]): string[] =>
      [
        ...stylesheetTags(page, tags).matchAll(
          /<link rel="stylesheet" href="([^"]+)"(?: data-l-css="([^"]+)")?>|<style data-l-css="([^"]+)">/g,
        ),
      ].flatMap((match) => (match[3] ?? match[2] ?? match[1]!).split(" "));
    for (const page of [home, about, post, editor, notFound]) expect(order(page)).toEqual(page);
    expect(stylesheetTags(home, tags)).toContain(`<style data-l-css="${url("home")}">${css.home}`);
    expect(stylesheetTags(editor, tags)).not.toContain(group.href);
    // Over 4 kB, the page's own stylesheet is linked; the not-found page's missing one too.
    expect(stylesheetTags(post, tags)).toContain(`<link rel="stylesheet" href="${url("post")}"`);
    expect(stylesheetTags(notFound, tags)).toContain(
      `<link rel="stylesheet" href="${url("missing")}"`,
    );
  });
});
