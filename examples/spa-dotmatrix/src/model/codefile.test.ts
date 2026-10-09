// Exported code files read back identically: songs, sound sheets, SFX and creature voices.
import { describe, expect, it } from "vitest";
import { sfxData, songData } from "../audio/driver.ts";
import { codeFile } from "../files.ts";
import { parseCode } from "./code.ts";
import { CREATURES, baseById, creatureSfx, cryHeader } from "./creatures.ts";
import { SFX, listing } from "./sfx.ts";
import { sfxToSheet } from "./sheet.ts";
import { exportSong, parseSong } from "./songcode.ts";
import { DEMOS } from "./songs/index.ts";
import { readStudioCode, studioCode } from "./studiocode.ts";
import type { ChannelIndex } from "./types.ts";

const ALL = [0, 1, 2, 3] as ChannelIndex[];

describe("exported code files", () => {
  for (const demo of DEMOS) {
    it(`song ${demo.title}`, () => {
      const song = demo.song();
      const result = parseSong(codeFile(exportSong(song)));
      if ("errors" in result) throw new Error(JSON.stringify(result.errors));
      expect(result.song).toEqual(song);
    });
  }

  const sounds = [
    ...SFX.map((sfx) => ({ sfx, kind: "sfx" as const, text: listing(sfx) })),
    ...CREATURES.map((c) => {
      const sfx = creatureSfx(c);
      return {
        sfx,
        kind: "voice" as const,
        text: `${cryHeader(baseById(c.base), c.pitch, c.length)}\n${listing(sfx)}`,
      };
    }),
  ];
  for (const { sfx, kind, text } of sounds) {
    it(`${kind} ${sfx.name}, in the maker and as a Studio sound sheet`, () => {
      const parsed = parseCode(codeFile(text), sfx.name);
      if ("errors" in parsed) throw new Error(JSON.stringify(parsed.errors));
      expect(sfxData(parsed.sfx).channels).toEqual(sfxData(sfx).channels);

      const sheet = sfxToSheet(sfx, kind);
      if (!("song" in sheet)) throw new Error("no sheet");
      const code = studioCode(sheet.song);
      if (!("text" in code)) throw new Error("no code");
      const back = readStudioCode(codeFile(code.text), sheet.song);
      if ("errors" in back) throw new Error(JSON.stringify(back.errors));
      expect(songData(back.song, ALL)).toEqual(songData(sheet.song, ALL));
      expect(back.song.sheet).toEqual(sheet.song.sheet);
    });
  }
});
