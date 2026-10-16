// @vitest-environment happy-dom
// On a custom element, the runtime sends a JSX prop to the element's property of the same name
// (React 19's rule). A getter without a setter there makes the assignment throw, so the island's
// hydration fails (TASK-411, found in TASK-375 with `min` on `lu-number-field`). This test imports
// every `lu-*` element, lists its read-only properties, and checks that no component writes an
// attribute of that name on its `<lu-…>` tag. Props that reach the tag through a spread
// (`{...rest}`) are not seen: the README's authoring rule covers them.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// happy-dom replaces the global `URL`: paths come from node:path.
const src = import.meta.dirname;
const files = readdirSync(src, { recursive: true, encoding: "utf8" }).filter(
  (path) => !path.includes(".test."),
);

/** The read-only properties (getters without setters) of a custom element, up to HTMLElement. */
function readOnly(element: CustomElementConstructor): string[] {
  const names: string[] = [];
  for (
    let proto = element.prototype as object | null;
    proto !== null && proto !== HTMLElement.prototype;
    proto = Object.getPrototypeOf(proto)
  ) {
    for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
      if (descriptor.get !== undefined && descriptor.set === undefined) names.push(name);
    }
  }
  return names;
}

/**
 * The attributes written by name on each `<lu-…>` tag of a JSX source, by tag. Expressions in
 * braces (`min={a > b ? 1 : 2}`, `{...rest}`) are skipped, so a `>` inside them does not end the tag.
 */
export function luAttributes(source: string): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  for (const match of source.matchAll(/<(lu-[a-z][a-z0-9-]*)/g)) {
    const names = found.get(match[1]!) ?? new Set<string>();
    found.set(match[1]!, names);
    let depth = 0;
    let quote = "";
    for (let i = match.index + match[0].length; i < source.length; i++) {
      const char = source[i]!;
      if (quote !== "") {
        if (char === quote) quote = "";
      } else if (char === '"' || char === "'" || char === "`") {
        quote = char;
      } else if (char === "{") {
        depth++;
      } else if (char === "}") {
        depth--;
      } else if (depth === 0 && char === ">") {
        break;
      } else if (depth === 0 && /\s/.test(source[i - 1]!) && /[A-Za-z_]/.test(char)) {
        const name = /^[A-Za-z_][\w:.-]*/.exec(source.slice(i))![0];
        names.add(name);
        i += name.length - 1;
      }
    }
  }
  return found;
}

beforeAll(async () => {
  for (const path of files.filter((file) => file.endsWith(".script.ts"))) {
    await import(join(src, path));
  }
});

describe("lu- elements and the props their components render (TASK-411)", () => {
  it("finds the attributes of a tag, past braces and spreads", () => {
    const tags = luAttributes(
      `<lu-a min={a > b ? 1 : 2} {...rest} on:change={() => x > 1} data-x="a>b" open>{c}</lu-a><lu-b\n  value={v}\n/>`,
    );
    expect([...tags.get("lu-a")!]).toEqual(["min", "on:change", "data-x", "open"]);
    expect([...tags.get("lu-b")!]).toEqual(["value"]);
  });

  it("gives no prop a component renders to a read-only property of its element", () => {
    const rendered = new Map<string, Set<string>>();
    for (const path of files.filter((file) => file.endsWith(".tsx"))) {
      for (const [tag, names] of luAttributes(readFileSync(join(src, path), "utf8"))) {
        rendered.set(tag, new Set([...(rendered.get(tag) ?? []), ...names]));
      }
    }
    expect(rendered.size).toBeGreaterThan(5);
    const clashes: string[] = [];
    for (const [tag, names] of rendered) {
      // A tag no script defines (`lu-field`) gets attributes only.
      const element = customElements.get(tag);
      if (element === undefined) continue;
      for (const name of readOnly(element)) {
        if (names.has(name))
          clashes.push(`<${tag}> renders \`${name}\`, a getter without a setter`);
      }
    }
    expect(clashes).toEqual([]);
  });
});
