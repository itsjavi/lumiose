import { describe, expect, it } from "vitest";
import { createHistory } from "./history.ts";
import { chords, drums, length, melody } from "./notation.ts";
import { SFX, applyMods, listing, NO_MODS } from "./sfx.ts";
import { decodeSong, encodeSong } from "./share.ts";
import { copyBars, placeNote, sanitizeSong } from "./song.ts";
import { DEMOS } from "./songs/index.ts";

describe("notation", () => {
  it("parses notes, rests, ties and bar checks", () => {
    expect(melody("C4:4 _:4 .:4 E4 | G4:16 |")).toEqual([
      { s: 0, l: 8, p: 60 },
      { s: 12, l: 4, p: 64 },
      { s: 16, l: 16, p: 67 },
    ]);
    expect(() => melody("C4:3 |")).toThrow(/Bar line/);
    expect(drums("K:2 S | ".replace("|", ""))).toEqual([
      { s: 0, l: 1, p: 7 },
      { s: 2, l: 1, p: 6 },
    ]);
  });
  it("expands chord symbols with a pattern", () => {
    expect(chords("Am F7", "1:4 3 5 7", 3)).toBe("A3:4 C4 E4 A4 | F3:4 A3 C4 D#4 |");
    expect(length(chords("C", "1:2 5 3' 5 1 5 3' 5", 3))).toBe(16);
  });
});

describe("songs", () => {
  it("places notes one at a time", () => {
    const notes = placeNote([{ s: 0, l: 8, p: 60 }], { s: 4, l: 2, p: 64 }, 16);
    expect(notes).toEqual([
      { s: 0, l: 4, p: 60 },
      { s: 4, l: 2, p: 64 },
    ]);
  });
  it("copies a bar over another on every track", () => {
    const song = DEMOS.find((d) => d.id === "first-steps")!.song();
    const tracks = copyBars(song, 0, 1, 3);
    expect(tracks[0].notes.filter((n) => n.s >= 48).map((n) => n.p)).toEqual(
      song.tracks[0].notes.filter((n) => n.s < 16).map((n) => n.p),
    );
  });
  it("repairs songs from outside", () => {
    const song = sanitizeSong({
      title: 42,
      bpm: 999,
      bars: 2,
      loop: 7,
      tracks: [
        {
          inst: { preset: "hero", duty: 9 },
          notes: [{ s: 40, l: 2, p: 60 }, { s: 0, l: 99, p: 300 }, "x"],
        },
        {},
        {},
        { notes: [{ s: 1, l: 5, p: 2 }] },
      ],
    });
    expect(song).toMatchObject({ title: "Untitled", bpm: 240, bars: 2, loop: 1 });
    expect(song.tracks[0].inst.duty).toBe(3);
    // The note past the end is dropped; the overlong one is cut at the end.
    expect(song.tracks[0].notes).toEqual([{ s: 0, l: 32, p: 120 }]);
    expect(song.tracks[3].notes).toEqual([{ s: 1, l: 1, p: 2 }]);
    expect(() => sanitizeSong({ tracks: [] })).toThrow();
  });
  it("round-trips through a share link", async () => {
    for (const demo of DEMOS) {
      const song = demo.song();
      const code = await encodeSong(song);
      expect(code.length).toBeLessThan(4000);
      expect(await decodeSong(code)).toEqual(song);
    }
    await expect(decodeSong("2.abc")).rejects.toThrow();
  });
});

describe("history", () => {
  it("undoes, redoes and merges keyed edits", () => {
    const h = createHistory<number>();
    h.push(0, "a");
    h.push(1, "slide", "k");
    h.push(2, "slide", "k");
    expect(h.undo(3)).toEqual({ state: 1, label: "slide" });
    expect(h.undo(1)).toEqual({ state: 0, label: "a" });
    expect(h.canUndo()).toBe(false);
    expect(h.redo(0)).toEqual({ state: 1, label: "a" });
  });
});

describe("sfx", () => {
  it("has at least ten original effects that bend and list as driver macros", () => {
    expect(SFX.length).toBeGreaterThanOrEqual(10);
    const jump = SFX.find((s) => s.id === "jump")!;
    const bent = applyMods(jump, { ...NO_MODS, pitch: 12, length: 2, sweep: -5, duty: 0 });
    expect(bent.voices[0]!.notes[0]).toMatchObject({ pitch: 84, frames: 32, sweep: -5, duty: 0 });
    expect(listing(bent)).toContain("pitch_sweep 1, -3");
    expect(listing(jump)).toContain("square_note 16, 12, 6, $706  ; C5");
  });
});
