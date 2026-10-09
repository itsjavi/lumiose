import { describe, expect, it } from "vitest";
import { renderEngineAudioToPcm } from "../../vendor/gbapu/dist/index.js";
import { DEMOS } from "../model/songs/index.ts";
import { STEPS_PER_BAR, type ChannelIndex } from "../model/types.ts";
import {
  channelData,
  envByte,
  freqReg,
  normalizeNotes,
  songData,
  stepCycles,
  sweepByte,
} from "./driver.ts";

function stats(pcm: Float32Array) {
  let peak = 0;
  let sum = 0;
  for (const s of pcm) {
    peak = Math.max(peak, Math.abs(s));
    sum += s * s;
  }
  return { peak, rms: Math.sqrt(sum / pcm.length) };
}

describe("registers", () => {
  it("maps A4 to the pulse and wave frequency registers", () => {
    // 131072 / (2048 - x) = 440 → x ≈ 1750; the wave divider is half: x ≈ 1899.
    expect(freqReg(69, false)).toBe(1750);
    expect(freqReg(69, true)).toBe(1899);
  });
  it("builds envelope and sweep bytes", () => {
    expect(envByte(15, 0)).toBe(0xf0);
    expect(envByte(12, 7)).toBe(0xc1); // fastest fade: pace 1, decreasing
    expect(envByte(3, -5)).toBe(0x3b); // swell: increasing, pace 3
    expect(sweepByte(0)).toBe(0);
    expect(sweepByte(-7) & 0x08).toBe(0x08);
  });
});

describe("notes", () => {
  it("keeps one note at a time and splits notes across the loop start", () => {
    const notes = normalizeNotes(
      [
        { s: 0, l: 8, p: 60 },
        { s: 4, l: 4, p: 62 },
        { s: 14, l: 6, p: 64 },
      ],
      32,
      16,
    );
    expect(notes).toEqual([
      { s: 0, l: 4, p: 60 },
      { s: 4, l: 4, p: 62 },
      { s: 14, l: 2, p: 64 },
      { s: 16, l: 4, p: 64 },
    ]);
  });
});

/**
 * Each demo channel rendered once on the real engine (at 16 kHz), shared by the
 * per-song checks below so CI renders every song only once.
 */
const levels = new Map<string, { peak: number; rms: number }[]>();
function channelLevels(id: string) {
  let found = levels.get(id);
  if (!found) {
    const song = DEMOS.find((d) => d.id === id)!.song();
    found = ([0, 1, 2, 3] as ChannelIndex[]).map((ch) =>
      stats(
        renderEngineAudioToPcm(songData(song, [ch]), { sampleRate: 16000, tailMs: 0 })
          .interleavedStereo,
      ),
    );
    levels.set(id, found);
  }
  return found;
}

describe("demo songs", () => {
  describe.each(DEMOS.map((d) => [d.title, d] as const))("%s", (_, demo) => {
    it("every track fits the song and every channel sounds", () => {
      const song = demo.song();
      const total = song.bars * STEPS_PER_BAR;
      for (const track of song.tracks) {
        for (const n of track.notes) expect(n.s + n.l).toBeLessThanOrEqual(total);
      }
      expect((total * 15) / song.bpm).toBeLessThan(65);
      for (const [ch, { peak, rms }] of channelLevels(demo.id).entries()) {
        expect(peak, `channel ${ch} peak`).toBeGreaterThan(0.02);
        expect(peak).toBeLessThanOrEqual(0.3);
        expect(rms).toBeGreaterThan(0.002);
      }
    });

    it("is balanced: no channel drowns the lead, none is inaudible", () => {
      const rms = channelLevels(demo.id).map((l) => l.rms);
      const lead = rms[0]!;
      for (const [ch, level] of rms.entries()) {
        expect(level / lead, `channel ${ch}`).toBeLessThan(2);
        expect(level, `channel ${ch}`).toBeGreaterThan(0.004);
      }
    });
  });

  it("marks the loop at the loop bar on every channel", () => {
    const song = DEMOS[1]!.song();
    const loopCycles = Math.round(song.loop * STEPS_PER_BAR * stepCycles(song.bpm));
    for (const ch of [0, 1, 2, 3] as ChannelIndex[]) {
      const data = channelData(song, ch, { loop: true });
      let at = 0;
      for (let i = 0; i < data.loopStartCommandIndex!; i++) {
        const c = data.commands[i]!;
        if (c[0] === "wait") at += c[1] as number;
      }
      expect(at).toBe(loopCycles);
    }
  });
});
