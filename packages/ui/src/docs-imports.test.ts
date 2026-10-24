// The docs' imports name what the entries export (TASK-543). A page's header imports its parts
// from "@lumiose/ui" and names the entries they also come from (`// or "@lumiose/ui/toggle" and
// "@lumiose/ui/toggle-group"`); examples may import from an entry directly. Every name must be
// exported by the entry it is imported from and by one of the entries the comment names, and every
// stylesheet an import or its comment names must be an entry. packages/cli's docs examples test
// type-checks the examples marked `check`.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const docs = join(root, "docs");
const { exports } = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  exports: Record<string, string>;
};

/** The file of an entry, such as "@lumiose/ui/toggle", if the package has it. */
const fileOf = (specifier: string) =>
  exports[specifier === "@lumiose/ui" ? "." : `./${specifier.slice("@lumiose/ui/".length)}`];

const NAMED = /^import \{([^}]*)\} from "(@lumiose\/ui[^"]*)";(?:[ \t]*\/\/ or (.*))?$/gm;
const BARE = /^import "(@lumiose\/ui[^"]*)";(.*)$/gm;
const SPECIFIER = /"(@lumiose\/ui[^"]*)"/g;

interface Claim {
  page: string;
  names: string[];
  /** Each name comes from one of these. */
  from: string[];
}

const pages = readdirSync(docs)
  .filter((file) => file.endsWith(".md"))
  .map((page) => ({ page, text: readFileSync(join(docs, page), "utf8") }));

const claims: Claim[] = pages.flatMap(({ page, text }) =>
  [...text.matchAll(NAMED)].flatMap(([, list, from, or]) => {
    // Types are not in a module's exports at runtime; the type-checked examples cover them.
    const names = list!
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name && !name.startsWith("type "));
    const alternatives = [...(or ?? "").matchAll(SPECIFIER)].map((match) => match[1]!);
    return [
      { page, names, from: [from!] },
      ...(alternatives.length > 0 ? [{ page, names, from: alternatives }] : []),
    ];
  }),
);

const stylesheets = pages.flatMap(({ page, text }) =>
  [...text.matchAll(BARE)].flatMap(([line]) =>
    [...line.matchAll(SPECIFIER)].map((match) => ({ page, specifier: match[1]! })),
  ),
);

describe("the docs' imports", () => {
  // The first import of an entry transforms the package's sources, which takes seconds in a busy
  // `pnpm check`: load every entry once here, with its own budget, so each case only reads exports.
  beforeAll(async () => {
    const files = new Set(claims.flatMap((claim) => claim.from.map(fileOf)));
    for (const file of files) if (file !== undefined) await import(join(root, file));
  }, 60_000);

  it("are found", () => {
    expect(claims.length).toBeGreaterThan(40);
    expect(stylesheets.length).toBeGreaterThan(20);
  });

  it.each(claims.map((claim) => [`${claim.page}: ${claim.from.join(" or ")}`, claim] as const))(
    "%s exports the names",
    async (_, claim) => {
      const modules = await Promise.all(
        claim.from.map(async (specifier) => {
          const file = fileOf(specifier);
          expect(file, `${specifier} is an entry of the package`).toBeDefined();
          return (await import(join(root, file!))) as Record<string, unknown>;
        }),
      );
      expect(claim.names.filter((name) => !modules.some((module) => name in module))).toEqual([]);
    },
  );

  it("name stylesheets the package exports", () => {
    expect(stylesheets.filter(({ specifier }) => fileOf(specifier) === undefined)).toEqual([]);
  });
});
