// Pitches, note names and scales.
import type { ScaleId } from "./types.ts";

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export const KEYS = NAMES;

/** "C4" for MIDI 60. */
export function noteName(midi: number): string {
  const n = Math.round(midi);
  return `${NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
}

/** MIDI number of a name such as "C4", "F#3" or "Bb2"; throws on anything else. */
export function parseNote(name: string): number {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!match) throw new Error(`Not a note: ${name}`);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1] as "C"];
  const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
  return base + accidental + (Number(match[3]) + 1) * 12;
}

export function hz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export const SCALES: Record<ScaleId, { name: string; steps: readonly number[] }> = {
  major: { name: "Major", steps: [0, 2, 4, 5, 7, 9, 11] },
  minor: { name: "Minor", steps: [0, 2, 3, 5, 7, 8, 10] },
  harmonicMinor: { name: "Harmonic minor", steps: [0, 2, 3, 5, 7, 8, 11] },
  dorian: { name: "Dorian", steps: [0, 2, 3, 5, 7, 9, 10] },
  pentatonic: { name: "Pentatonic", steps: [0, 2, 4, 7, 9] },
  minorPentatonic: { name: "Minor pentatonic", steps: [0, 3, 5, 7, 10] },
  chromatic: { name: "Chromatic", steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
};

export function inScale(midi: number, key: number, scale: ScaleId): boolean {
  return SCALES[scale].steps.includes((((midi - key) % 12) + 12) % 12);
}

/** The grid rows for a pitch range, highest first: scale notes plus any notes already used. */
export function scaleRows(
  low: number,
  high: number,
  key: number,
  scale: ScaleId,
  used: Iterable<number> = [],
): number[] {
  const rows = new Set<number>();
  for (let m = low; m <= high; m++) if (inScale(m, key, scale)) rows.add(m);
  for (const m of used) rows.add(m);
  return [...rows].toSorted((a, b) => b - a);
}
