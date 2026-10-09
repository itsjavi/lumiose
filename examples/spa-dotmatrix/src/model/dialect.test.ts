import { describe, expect, it } from "vitest";
import { codeDialect, parseCode } from "./code.ts";
import { CREATURES, baseById, creatureSfx, cryHeader } from "./creatures.ts";
import { SFX, listing } from "./sfx.ts";
import { sfxToSheet } from "./sheet.ts";
import { exportSong } from "./songcode.ts";
import { DEMOS } from "./songs/index.ts";
import { readStudioCode } from "./studiocode.ts";

const song = DEMOS[0]!.song();
const c = CREATURES[3]!;
const cry = `${cryHeader(baseById(c.base), c.pitch, c.length)}\n${listing(creatureSfx(c))}`;
const sfxCode = listing(SFX.find((s) => s.id === "jump")!);
const songCode = exportSong(song);

describe("code dialects", () => {
  it("tells sound-effect, cry and song code apart", () => {
    expect(codeDialect(cry)).toEqual({ kind: "sfx", voice: true });
    expect(codeDialect(sfxCode)).toEqual({ kind: "sfx", voice: false });
    expect(codeDialect(songCode)).toEqual({ kind: "song" });
    expect(codeDialect("; nothing here")).toEqual({ kind: "unknown" });
  });

  it("opens cry and SFX code as a new sound sheet while a song is open", () => {
    const voice = readStudioCode(cry, song, { name: "wispet", fresh: true });
    expect("song" in voice && voice.song.sheet).toEqual({
      kind: "voice",
      name: "wispet",
      ticks: 1,
    });
    const pasted = readStudioCode(sfxCode, song);
    expect("song" in pasted && pasted.song.sheet).toEqual({
      kind: "sfx",
      name: "Pasted sound",
      ticks: 1,
    });
  });

  it("opens song code as a song while a sound sheet is open", () => {
    const sheet = sfxToSheet(SFX[0]!, "sfx");
    if (!("song" in sheet)) throw new Error();
    const result = readStudioCode(songCode, sheet.song);
    expect("song" in result && result.song).toEqual(song);
  });

  it("gives one clear error for a file that mixes both", () => {
    const mixed = `${songCode}\n; pulse 2\n  square_note 4, 12, 1, $700\n`;
    const studio = readStudioCode(mixed, song);
    expect("errors" in studio && studio.errors).toHaveLength(1);
    expect("errors" in studio && studio.errors[0]!.message).toMatch(
      /^This file mixes song commands \(.*note.*\) and sound-effect commands \(square_note\); Dotmatrix opens one kind per file$/,
    );
    const maker = parseCode(songCode);
    expect("errors" in maker && maker.errors).toEqual([
      { line: 1, message: "This is song code: open it in the Studio (Code, then Import file…)" },
    ]);
  });
});
