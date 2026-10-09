import { describe, expect, it } from "vitest";
import { songData } from "../audio/driver.ts";
import { exportSong, parseSong } from "./songcode.ts";
import { DEMOS } from "./songs/index.ts";
import { emptySong } from "./song.ts";
import type { ChannelIndex } from "./types.ts";

const ALL = [0, 1, 2, 3] as ChannelIndex[];

describe("song code", () => {
  for (const demo of DEMOS) {
    it(`${demo.title}: exports to music macros and parses back identically`, () => {
      const song = demo.song();
      const result = parseSong(exportSong(song));
      if ("errors" in result)
        throw new Error(result.errors.map((e) => `${e.line}: ${e.message}`).join("\n"));
      expect(result.song).toEqual(song);
      expect(songData(result.song, ALL, { loop: true })).toEqual(
        songData(song, ALL, { loop: true }),
      );
      expect(exportSong(result.song)).toBe(exportSong(song));
    });
  }

  it("keeps mute, solo, panning and per-note settings", () => {
    const song = emptySong();
    song.tracks[1].mute = true;
    song.tracks[2].solo = true;
    song.tracks[0].pan = "L";
    song.tracks[0].notes = [{ s: 2, l: 3, p: 70, v: 9, t: 0.25 }];
    song.tracks[3].notes = [{ s: 0, l: 1, p: 7 }];
    const result = parseSong(exportSong(song));
    if ("errors" in result) throw new Error(JSON.stringify(result.errors));
    expect(result.song).toEqual(song);
  });

  it("reports errors by line", () => {
    const result = parseSong(
      [
        "tempo 300",
        "note C_, 4",
        "; pulse 1",
        "  octave 5",
        "  note H_, 4",
        "  rest 3",
        ".mainloop:",
        "  drum_note 1, 1",
        "  wave_shape soft",
        "; noise",
        "  drum_note 9, 1",
        "  floop 1",
      ].join("\n"),
    );
    expect("errors" in result && result.errors.map((e) => e.line)).toEqual([
      1, 2, 5, 7, 8, 9, 11, 12,
    ]);
  });
});
