import { describe, expect, it } from "vitest";
import { renderEngineAudioToPcm } from "../../vendor/gbaudio/dist/index.js";
import { sfxData, songData } from "../audio/driver.ts";
import { BASES, CREATURES, creatureSfx } from "./creatures.ts";
import { SFX } from "./sfx.ts";
import { sheetToSfx, sfxToSheet } from "./sheet.ts";
import { decodeSong, encodeSong } from "./share.ts";
import { sanitizeSong } from "./song.ts";
import type { Sfx, Song } from "./types.ts";

const render = (data: Parameters<typeof renderEngineAudioToPcm>[0]) =>
  renderEngineAudioToPcm(data, { sampleRate: 16000, tailMs: 200 }).interleavedStereo;

/**
 * How different two renders sound: the RMS envelopes (10 ms windows) compared, relative to the
 * first. Waveform phase may differ (a rest retriggers the channel in the maker, not in the studio),
 * which is inaudible, so samples are not compared one by one.
 */
function difference(a: Float32Array, b: Float32Array): number {
  const window = 320; // 10 ms of interleaved stereo at 16 kHz
  let diff = 0;
  let base = 0;
  for (let w = 0; w < a.length; w += window) {
    let ea = 0;
    let eb = 0;
    for (let i = w; i < w + window && i < a.length; i++) {
      ea += a[i]! * a[i]!;
      eb += (b[i] ?? 0) * (b[i] ?? 0);
    }
    diff += (Math.sqrt(ea) - Math.sqrt(eb)) ** 2;
    base += ea;
  }
  return Math.sqrt(diff / Math.max(base, 1e-9));
}

const sounds: Sfx[] = [...SFX, ...CREATURES.map(creatureSfx)];

describe("sound sheets", () => {
  for (const sfx of sounds) {
    it(`${sfx.name}: opens in the studio and comes back without losing anything`, () => {
      const result = sfxToSheet(sfx, "sfx");
      if (!("song" in result)) throw new Error(result.reasons.join());
      const sheet: Song = sanitizeSong(JSON.parse(JSON.stringify(result.song)));
      expect(sheet).toEqual(result.song);
      // The studio plays each channel of the sheet like the maker plays that voice (channel by
      // channel: two pulses at one pitch interfere differently with another start phase), and
      // back in the maker it is the same sound again.
      const back = sheetToSfx(sheet, sfx.id);
      if (!("sfx" in back)) throw new Error(back.reasons.join());
      for (const voice of sfx.voices) {
        const original = render(sfxData({ ...sfx, voices: [voice] }));
        const studio = render(songData(sheet, [voice.channel]));
        expect(difference(original, studio), `channel ${voice.channel}`).toBeLessThan(0.02);
        const again = back.sfx.voices.find((v) => v.channel === voice.channel)!;
        expect(difference(original, render(sfxData({ ...sfx, voices: [again] })))).toBeLessThan(
          0.02,
        );
      }
    });
  }

  it("explains why a sheet with studio-only features cannot go back to the maker", () => {
    const result = sfxToSheet(SFX[0]!, "sfx");
    if (!("song" in result)) throw new Error();
    result.song.tracks[0].inst.vibrato.depth = 3;
    result.song.tracks[2].notes = [{ s: 0, l: 4, p: 45 }];
    const back = sheetToSfx(result.song, "x");
    expect("reasons" in back && back.reasons).toEqual([
      "Pulse 1 has vibrato",
      "it uses the Wave channel (sound effects use the pulses and noise)",
    ]);
  });

  it("keeps per-note settings in share links", async () => {
    const result = sfxToSheet(creatureSfx(CREATURES[0]!), "voice");
    if (!("song" in result)) throw new Error();
    expect(await decodeSong(await encodeSong(result.song))).toEqual(result.song);
  });
});

describe("creatures", () => {
  it("has at least twelve voices on a handful of base voices, each audible", () => {
    expect(CREATURES.length).toBeGreaterThanOrEqual(12);
    expect(BASES.length).toBeGreaterThanOrEqual(5);
    for (const c of CREATURES) {
      expect(c.sprite).toHaveLength(12);
      for (const row of c.sprite) expect(row).toMatch(/^[.abc]{12}$/);
      const pcm = render(sfxData(creatureSfx(c)));
      expect(Math.max(...pcm.map(Math.abs)), c.name).toBeGreaterThan(0.05);
    }
  });
});
