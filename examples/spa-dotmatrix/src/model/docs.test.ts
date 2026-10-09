// Keeps the composing guide's examples true to the code.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { freqReg } from "../audio/driver.ts";
import { parseNote } from "./music.ts";
import { length } from "./notation.ts";
import { parseSong } from "./songcode.ts";

const guide = readFileSync(new URL("../../docs/composing.md", import.meta.url), "utf8");

describe("docs/composing.md", () => {
  it("lists frequency registers that match the driver", () => {
    const rows = [...guide.matchAll(/\| ([A-G]#?\d) +\| [\d.]+ +\| \$([0-9A-F]{3}) +\|/g)];
    expect(rows.length).toBeGreaterThanOrEqual(6);
    for (const [, note, reg] of rows)
      expect(freqReg(parseNote(note!), false), note).toBe(parseInt(reg!, 16));
  });

  it("has a melody example whose bars add up", () => {
    const src = /melody\("([^"]+)"\)/.exec(guide)![1]!;
    expect(length(src)).toBe(64);
  });

  it("has a song-code example that parses", () => {
    const block = /```asm\n(; Dotmatrix song[\s\S]*?)```/.exec(guide)![1]!;
    const result = parseSong(block);
    expect("song" in result && result.song.title).toBe("Little March");
  });
});
