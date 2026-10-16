// A page's stylesheet tags in builds (TASK-121, TASK-285), and the script after linked ones
// (TASK-278).
import { describe, expect, it } from "vitest";
import { STYLESHEETS_LOADED, stylesheetTags, type StyleTags } from "./stylesheets.ts";

const tags: StyleTags = {
  shared: { href: "/assets/styles.css", covers: ["/a.css", "/b.css"] },
  rest: {
    "/small.css": '<style data-l-css="/small.css">.s{}</style>',
    "/big.css /more.css":
      '<link rel="stylesheet" href="/assets/page.css" data-l-css="/big.css /more.css">',
  },
};

describe("stylesheetTags", () => {
  it("links the shared file, then the page's own tag, then waits for the linked files", () => {
    expect(stylesheetTags(["/a.css", "/b.css", "/big.css", "/more.css"], tags)).toBe(
      '<link rel="stylesheet" href="/assets/styles.css" data-l-css="/a.css /b.css">' +
        '<link rel="stylesheet" href="/assets/page.css" data-l-css="/big.css /more.css">' +
        STYLESHEETS_LOADED,
    );
    expect(stylesheetTags(["/a.css", "/b.css", "/small.css"], tags)).toBe(
      '<link rel="stylesheet" href="/assets/styles.css" data-l-css="/a.css /b.css">' +
        '<style data-l-css="/small.css">.s{}</style>' +
        STYLESHEETS_LOADED,
    );
  });

  it("links the group file a page's stylesheets continue with, after the shared file (TASK-285)", () => {
    const grouped: StyleTags = {
      ...tags,
      groups: [
        { href: "/assets/styles-site.css", covers: ["/site.css", "/nav.css"] },
        { href: "/editor.css", covers: ["/editor.css"] },
      ],
    };
    expect(
      stylesheetTags(["/a.css", "/b.css", "/site.css", "/nav.css", "/small.css"], grouped),
    ).toBe(
      '<link rel="stylesheet" href="/assets/styles.css" data-l-css="/a.css /b.css">' +
        '<link rel="stylesheet" href="/assets/styles-site.css" data-l-css="/site.css /nav.css">' +
        '<style data-l-css="/small.css">.s{}</style>' +
        STYLESHEETS_LOADED,
    );
    // One stylesheet is linked as it is, and covers nothing else.
    expect(stylesheetTags(["/a.css", "/b.css", "/editor.css"], grouped)).toBe(
      '<link rel="stylesheet" href="/assets/styles.css" data-l-css="/a.css /b.css">' +
        '<link rel="stylesheet" href="/editor.css">' +
        STYLESHEETS_LOADED,
    );
    // A page that holds only part of a group's run gets none of its file: its own CSS has all of it.
    expect(stylesheetTags(["/a.css", "/b.css", "/site.css", "/small.css"], grouped)).toBe(
      '<link rel="stylesheet" href="/assets/styles.css" data-l-css="/a.css /b.css">' +
        '<link rel="stylesheet" href="/site.css"><link rel="stylesheet" href="/small.css">' +
        STYLESHEETS_LOADED,
    );
    // Without a shared file, a group's run starts the page.
    const withoutShared: StyleTags = { groups: grouped.groups!, rest: tags.rest };
    expect(stylesheetTags(["/site.css", "/nav.css"], withoutShared)).toBe(
      '<link rel="stylesheet" href="/assets/styles-site.css" data-l-css="/site.css /nav.css">' +
        STYLESHEETS_LOADED,
    );
  });

  it("does not wait when nothing is linked", () => {
    expect(stylesheetTags(["/small.css"], tags)).toBe(
      '<style data-l-css="/small.css">.s{}</style>',
    );
    expect(stylesheetTags([], tags)).toBe("");
    expect(stylesheetTags([], undefined)).toBe("");
  });

  it("links each stylesheet the build did not group, then waits", () => {
    expect(stylesheetTags(["/x.css", "/y.css"], undefined)).toBe(
      '<link rel="stylesheet" href="/x.css"><link rel="stylesheet" href="/y.css">' +
        STYLESHEETS_LOADED,
    );
  });

  it("waits with a script that is not empty: an empty one would not wait", () => {
    expect(STYLESHEETS_LOADED).toMatch(/^<script>[^<]+<\/script>$/);
  });
});
