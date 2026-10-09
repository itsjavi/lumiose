// Composition heuristics over every demo song (see composition.ts). Songs listed in KNOWN fail some
// of them today; they were written before the check and are waiting for a rewrite.
import { describe, expect, it } from "vitest";
import { analyse, failures } from "./composition.ts";
import { DEMOS } from "./songs/index.ts";

const KNOWN = new Set([
  "maple-hollow",
  "over-the-ridge",
  "rival-clash",
  "last-stand",
  "lantern-night",
  "bumbling-along",
  "faded-letters",
  "roll-credits",
]);

describe("composition", () => {
  for (const demo of DEMOS) {
    if (KNOWN.has(demo.id)) {
      it.skip(`${demo.title} (known: ${failures(analyse(demo.song())).join("; ")})`, () => {});
      continue;
    }
    it(`${demo.title}: chord tones on strong beats, mostly steps, singable, no clashes, ends home`, () => {
      expect(failures(analyse(demo.song()))).toEqual([]);
    });
  }

  it("the known list only names songs that still fail", () => {
    for (const demo of DEMOS.filter((d) => KNOWN.has(d.id))) {
      expect(failures(analyse(demo.song())).length, demo.title).toBeGreaterThan(0);
    }
  });
});
