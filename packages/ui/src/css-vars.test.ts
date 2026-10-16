// Every CSS custom property a component sets or reads carries the `--lu-` prefix, like the default
// theme's tokens (decision-62, user, 2026-10-16): an app's own variables and another library's
// cannot collide with ours. Base UI's `--collapsible-panel-height` is `--lu-collapsible-panel-height`
// here. Invoker commands (`--toggle`, `--close-toast`) also start with `--` but are not custom
// properties, so only declarations, `var()` references and `style` property calls are checked.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = import.meta.dirname;
const files = readdirSync(src, { recursive: true, encoding: "utf8" }).filter(
  (path) => /\.(css|tsx?)$/.test(path) && !path.includes(".test."),
);

const PATTERNS = [
  // A declaration in CSS or in a style string: `--name: value`.
  /(?<![\w-])--([a-z][\w-]*)\s*:/g,
  // A reference: `var(--name)`.
  /var\(\s*--([a-z][\w-]*)/g,
  // A `style` call with a literal name: `setProperty("--name", …)`, including a template prefix.
  /(?:setProperty|removeProperty|getPropertyValue)\(\s*["'`]--([a-z][\w-]*)/g,
  // A key in a style object: `{ "--name": value }`.
  /["']--([a-z][\w-]*)["']\s*:/g,
];

/** The custom property names a source file sets or reads. */
function customProperties(text: string): string[] {
  return PATTERNS.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[1]!));
}

describe("component CSS custom properties", () => {
  it("finds the properties it checks", () => {
    const names = files.flatMap((file) => customProperties(readFileSync(join(src, file), "utf8")));
    expect(names).toContain("lu-collapsible-panel-height");
    expect(names).toContain("lu-side-offset");
  });

  it.each(files)("%s uses only --lu- custom properties", (file) => {
    const names = customProperties(readFileSync(join(src, file), "utf8"));
    expect(names.filter((name) => !name.startsWith("lu-"))).toEqual([]);
  });
});
