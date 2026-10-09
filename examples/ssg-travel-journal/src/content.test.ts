import { renderToString } from "lumen/server";
import { describe, expect, it } from "vitest";
import { adjacentPosts, allPosts, allTags, findPost, postsTagged } from "./content.ts";
import { postFrontmatter } from "./frontmatter.ts";

describe("the posts in content/posts", () => {
  it("loads every post, newest first, with unique slugs", async () => {
    const posts = allPosts();
    expect(posts.length).toBeGreaterThanOrEqual(8);
    expect(new Set(posts.map((post) => post.slug)).size).toBe(posts.length);
    const dates = posts.map((post) => post.date);
    expect(dates).toEqual(dates.toSorted().toReversed());
    for (const post of posts) {
      expect(await renderToString(post.Content)).toContain("<p>");
      expect(post.cover).toMatch(/^\/covers\/.+\.svg$/);
      expect(post.readingMinutes).toBeGreaterThanOrEqual(1);
    }
  });

  it("lists the ## headings with the ids of the rendered anchors", async () => {
    const post = findPost("dolomites-hut-to-hut")!;
    expect(post.headings.map(({ text, id }) => ({ text, id }))).toEqual([
      { text: "The stages", id: "the-stages" },
      { text: "Notes for next time", id: "notes-for-next-time" },
    ]);
    const html = await renderToString(post.Content);
    for (const heading of post.headings) expect(html).toContain(`<h2 id=${heading.id}>`);
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

describe("postFrontmatter (the lumen({ md }) hook)", () => {
  const file = "/site/content/posts/sea-walk.md";
  const data = {
    title: " A walk: by the sea ",
    date: "2026-01-02",
    tags: ["coast", "slow-travel", "coast"],
    summary: "Salt and wind.",
    cover: "/covers/a.svg",
  };
  const source = `---\ntitle: x\n---\n${"word ".repeat(450)}`;

  it("validates the fields and adds the reading time", () => {
    expect(postFrontmatter(data, file, source)).toEqual({
      title: "A walk: by the sea",
      date: "2026-01-02",
      tags: ["coast", "slow-travel"],
      summary: "Salt and wind.",
      cover: "/covers/a.svg",
      readingMinutes: 2,
    });
  });

  it("rejects invalid fields and file names", () => {
    const check =
      (fields: Record<string, unknown>, path = file) =>
      () =>
        postFrontmatter({ ...data, ...fields }, path, source);
    expect(check({ date: "soon" })).toThrow('"date" must be a day');
    expect(check({ tags: ["Coast"] })).toThrow('tag "Coast" must be a lowercase slug');
    expect(check({ tags: [] })).toThrow('"tags" must be a non-empty list');
    expect(check({ title: undefined })).toThrow('"title" must be a non-empty string');
    expect(check({ cover: "covers/a.svg" })).toThrow('"cover" must be a site path');
    expect(check({}, "/site/content/posts/Bad Name.md")).toThrow(
      "the file name must be a lowercase slug",
    );
  });
});
