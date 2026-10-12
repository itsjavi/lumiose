// The fast paths of isUnsafeUrl and the URL attribute check must decide exactly as the plain
// regexes do (decision-29). Client/server parity is covered in ../server/parity.test.ts.
import { describe, expect, it } from "vitest";
import { BLOCKED_URL, isUnsafeUrl, safeAttrValue } from "./url.ts";

// The implementation before the fast paths, as the reference.
function referenceUnsafe(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /^(?:javascript|vbscript):|^data:\s*text\/html/i.test(
    value.replace(/^[\0- ]+|[\t\n\r]/g, ""),
  );
}

const referenceUrlAttribute = (name: string) =>
  /^(?:href|src|action|formaction|xlink:href|poster|data|cite|background)$/i.test(name);

/** Deterministic PRNG (mulberry32), so failures reproduce. */
function random(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEEDS = [
  "javascript:alert(1)",
  "vbscript:msgbox(1)",
  "data:text/html,<b>",
  "data: text/html;base64,AAAA",
  "data:image/png;base64,AAAA",
  "/items/1?ref=a&sort=asc",
  "https://example.com/a",
  "mailto:a@example.com",
  "#javascript:x",
  "jump:x",
  "video.mp4",
  "",
];
// Characters the browser strips (leading C0 controls and spaces; tabs and newlines anywhere),
// characters that alias j/v/d under `| 32`, and a few ordinary ones.
const NOISE = ["\0", "\u0001", "\t", "\n", "\r", "\u001f", " ", "J", "V", "D", "*", ":", "/", "&"];

describe("isUnsafeUrl fast paths", () => {
  it("decide exactly as the regex on every short string over the noise alphabet", () => {
    const alphabet = [...NOISE, "j", "v", "d", "a"];
    const values = [""];
    for (let length = 1; length <= 3; length++) {
      for (const prefix of values.filter((value) => value.length === length - 1)) {
        for (const char of alphabet) values.push(prefix + char);
      }
    }
    for (const value of values) {
      for (const tail of ["", "avascript:x", "bscript:x", "ata:text/html,x"]) {
        expect(isUnsafeUrl(value + tail), JSON.stringify(value + tail)).toBe(
          referenceUnsafe(value + tail),
        );
      }
    }
  });

  it("decide exactly as the regex on mutated URLs", () => {
    const next = random(168);
    const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)]!;
    for (let i = 0; i < 20_000; i++) {
      let value = pick(SEEDS);
      const edits = Math.floor(next() * 4);
      for (let e = 0; e < edits; e++) {
        const at = Math.floor(next() * (value.length + 1));
        value = value.slice(0, at) + pick(NOISE) + value.slice(at);
      }
      if (next() < 0.3) value = value.toUpperCase();
      expect(isUnsafeUrl(value), JSON.stringify(value)).toBe(referenceUnsafe(value));
    }
  });
});

describe("safeAttrValue", () => {
  it("checks exactly the URL attributes, in any case", () => {
    // URL attributes, other cases, then names of the same lengths and near misses.
    const names = [
      "href",
      "src",
      "action",
      "formaction",
      "xlink:href",
      "poster",
      "data",
      "cite",
      "background",
      "HREF",
      "Src",
      "FormAction",
      "title",
      "class",
      "data-id",
      "srcset",
      "hrefs",
      "id",
      "a",
      "",
      "xlink:hre",
      "backgrounds",
      "alt",
      "rel",
      "type",
      "name",
    ];
    for (const name of names) {
      const expected = referenceUrlAttribute(name) ? BLOCKED_URL : "javascript:alert(1)";
      expect(safeAttrValue(name, "javascript:alert(1)"), name).toBe(expected);
      expect(safeAttrValue(name, "/ok"), name).toBe("/ok");
    }
  });
});
