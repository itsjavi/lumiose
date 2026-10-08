import { describe, expect, it } from "vitest";
import { adjacentPosts, allPosts, allTags, findPost, parsePost, postsTagged } from "./content.ts";

const source = (frontmatter: string, body = "Hello.") => `---\n${frontmatter}\n---\n${body}`;
const valid = [
  'title: "A walk: by the sea"',
  "date: 2026-01-02",
  "tags: [coast, slow-travel]",
  "summary: Salt and wind.",
  "cover: /covers/a.svg",
].join("\n");

describe("the posts in content/posts", () => {
  it("parses every post, newest first, with unique slugs", () => {
    const posts = allPosts();
    expect(posts.length).toBeGreaterThanOrEqual(8);
    expect(new Set(posts.map((post) => post.slug)).size).toBe(posts.length);
    const dates = posts.map((post) => post.date);
    expect(dates).toEqual(dates.toSorted().toReversed());
    for (const post of posts) {
      expect(post.html).toContain("<p>");
      expect(post.cover).toMatch(/^\/covers\/.+\.svg$/);
    }
  });

  it("finds posts, their neighbours and tags", () => {
    const [newest, second] = allPosts();
    expect(findPost(newest!.slug)).toBe(newest);
    expect(findPost("missing")).toBeUndefined();
    expect(adjacentPosts(second!.slug)).toEqual({ newer: newest, older: allPosts()[2] });
    expect(adjacentPosts(newest!.slug).newer).toBeUndefined();

    const tags = allTags();
    expect(tags.reduce((sum, tag) => sum + tag.count, 0)).toBe(
      allPosts().reduce((sum, post) => sum + post.tags.length, 0),
    );
    for (const { tag, count } of tags) expect(postsTagged(tag)).toHaveLength(count);
    expect(postsTagged("no-such-tag")).toEqual([]);
  });
});

describe("parsePost", () => {
  it("reads the frontmatter and renders the Markdown body", () => {
    const post = parsePost(
      "../content/posts/sea-walk.md",
      source(valid, "Intro.\n\n## First *stop*\n\nText.\n\n## First stop\n\n### Detail\n"),
    );
    expect(post).toMatchObject({
      slug: "sea-walk",
      title: "A walk: by the sea",
      date: "2026-01-02",
      tags: ["coast", "slow-travel"],
      summary: "Salt and wind.",
      cover: "/covers/a.svg",
      readingMinutes: 1,
    });
    // `##` headings get unique ids and anchors, and make the table of contents.
    expect(post.headings).toEqual([
      { id: "first-stop", text: "First stop" },
      { id: "first-stop-2", text: "First stop" },
    ]);
    expect(post.html).toContain('<h2 id="first-stop"><a class="anchor" href="#first-stop"');
    expect(post.html).toContain("<em>stop</em></h2>");
    expect(post.html).toContain('<h3 id="detail">');
  });

  it("reports invalid files with their path", () => {
    const file = "../content/posts/bad.md";
    expect(() => parsePost(file, "No frontmatter")).toThrow(`${file}: expected frontmatter`);
    expect(() => parsePost(file, source("title: a: b"))).toThrow(
      `${file}: the frontmatter is not valid YAML`,
    );
    expect(() => parsePost(file, source(valid.replace("date: 2026-01-02", "date: soon")))).toThrow(
      'frontmatter "date" must be a day',
    );
    expect(() => parsePost(file, source(valid.replace("[coast, slow-travel]", "[Coast]")))).toThrow(
      'tag "Coast" must be a lowercase slug',
    );
    expect(() => parsePost(file, source(valid.replace('title: "A walk: by the sea"', "")))).toThrow(
      'frontmatter "title" must be a non-empty string',
    );
    expect(() => parsePost("../content/posts/Bad Name.md", source(valid))).toThrow(
      "the file name must be a lowercase slug",
    );
  });
});
