// Sound tables authored for Dotmatrix: the wave channel's 32-sample shapes and the noise drum kit.
// Both are computed or written here from scratch; none comes from a game.
import type { WaveShape } from "../model/types.ts";

/** 32 four-bit samples (0–15) per shape. */
function table(fn: (phase: number) => number): number[] {
  const raw = Array.from({ length: 32 }, (_, i) => fn(i / 32));
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  return raw.map((v) => Math.round(((v - min) / (max - min || 1)) * 15));
}

const TAU = Math.PI * 2;

export const WAVES: Record<WaveShape, { name: string; samples: number[] }> = {
  soft: { name: "Soft (sine)", samples: table((x) => Math.sin(TAU * x)) },
  triangle: { name: "Triangle", samples: table((x) => 1 - 4 * Math.abs(x - 0.5)) },
  saw: { name: "Saw", samples: table((x) => x) },
  square: { name: "Square", samples: table((x) => (x < 0.5 ? 1 : 0)) },
  organ: {
    name: "Organ",
    samples: table(
      (x) => Math.sin(TAU * x) + 0.5 * Math.sin(2 * TAU * x) + 0.3 * Math.sin(4 * TAU * x),
    ),
  },
  hollow: {
    name: "Hollow",
    samples: table(
      (x) => Math.sin(TAU * x) + 0.45 * Math.sin(3 * TAU * x) + 0.2 * Math.sin(5 * TAU * x),
    ),
  },
};

/** Wave RAM bytes: two samples per byte, high nibble first. */
export function waveBytes(shape: WaveShape): number[] {
  const s = WAVES[shape].samples;
  return Array.from({ length: 16 }, (_, i) => (s[i * 2]! << 4) | s[i * 2 + 1]!);
}

/**
 * One frame group of a drum: `frames` long, start volume, envelope pace (1 fastest), and the noise
 * clock: shift `s` (higher is darker), `w` 7-bit mode (metallic, tonal), divisor code `r`.
 */
export interface DrumStep {
  frames: number;
  vol: number;
  pace: number;
  s: number;
  w: 0 | 1;
  r: number;
}

const d = (frames: number, vol: number, pace: number, s: number, r: number, w: 0 | 1 = 0) => ({
  frames,
  vol,
  pace,
  s,
  w,
  r,
});

/** The kit, in DRUMS order (crash, open hat, hi-hat, shaker, high tom, low tom, snare, kick). */
export const KIT: DrumStep[][] = [
  [d(1, 12, 6, 1, 3), d(1, 11, 6, 2, 2)],
  [d(1, 9, 4, 0, 2)],
  [d(1, 9, 1, 0, 1)],
  [d(1, 6, 1, 1, 0), d(1, 10, 1, 1, 1), d(1, 7, 2, 2, 0)],
  [d(1, 13, 2, 4, 2, 1), d(2, 11, 2, 4, 4, 1), d(2, 9, 3, 5, 1, 1)],
  [d(1, 13, 2, 5, 2, 1), d(2, 11, 2, 5, 4, 1), d(2, 9, 3, 6, 1, 1)],
  [d(1, 14, 2, 2, 1), d(2, 11, 2, 3, 2)],
  [d(1, 15, 1, 4, 1), d(1, 12, 2, 5, 3), d(2, 10, 2, 6, 5)],
];

/** NR43 for a drum step, with a brightness offset (tone > 0 lowers the shift: brighter). */
export function noiseByte(step: DrumStep, tone = 0): number {
  const s = Math.min(13, Math.max(0, step.s - tone));
  return (s << 4) | (step.w << 3) | (step.r & 7);
}
