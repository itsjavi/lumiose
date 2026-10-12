// Composition heuristics over every demo song (see composition.ts): each one must pass them all.
import { describe, expect, it } from "vitest";
import { analyse, failures } from "./composition.ts";
import { DEMOS } from "./songs/index.ts";

describe("composition", () => {
  for (const demo of DEMOS) {
    it(`${demo.title}: chord tones on strong beats, mostly steps, singable, no clashes, ends home`, () => {
      expect(failures(analyse(demo.song()))).toEqual([]);
    });
  }
});
