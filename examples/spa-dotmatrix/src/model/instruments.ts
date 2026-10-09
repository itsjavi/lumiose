// Friendly instrument presets per channel kind, and the drum kit's names. A preset is a complete
// Instrument, so picking one replaces every field; the advanced controls then edit it.
import type { ChannelKind, Instrument } from "./types.ts";

export interface Preset {
  id: string;
  name: string;
  hint: string;
  inst: Instrument;
}

const base: Instrument = {
  preset: "",
  duty: 2,
  volume: 12,
  env: 0,
  vibrato: { delay: 0, depth: 0, rate: 3 },
  glide: 0,
  arp: "off",
  shimmer: false,
  gate: 1,
  shape: "soft",
  tone: 0,
};

function preset(id: string, name: string, hint: string, fields: Partial<Instrument>): Preset {
  return { id, name, hint, inst: { ...base, ...fields, preset: id } };
}

export const PRESETS: Record<ChannelKind, Preset[]> = {
  pulse: [
    preset("hero", "Hero lead", "Bright 50% square with a late vibrato", {
      duty: 2,
      volume: 11,
      env: 1,
      vibrato: { delay: 14, depth: 3, rate: 3 },
      gate: 1,
    }),
    preset("reed", "Reed lead", "Mellow 25% duty, gentle vibrato", {
      duty: 1,
      volume: 11,
      env: 1,
      vibrato: { delay: 18, depth: 2, rate: 4 },
      gate: 0,
    }),
    preset("thin", "Thin lead", "Nasal 12.5% duty that cuts through", {
      duty: 0,
      volume: 13,
      env: 2,
      vibrato: { delay: 8, depth: 3, rate: 2 },
    }),
    preset("bell", "Music box", "Short 12.5% pings that fade fast", {
      duty: 0,
      volume: 10,
      env: 5,
      gate: 0,
    }),
    preset("arp", "Arp chords", "One note plays a whole major chord", {
      duty: 1,
      volume: 8,
      env: 1,
      arp: "major",
    }),
    preset("swell", "Brass swell", "Fades in, then wobbles", {
      duty: 2,
      volume: 3,
      env: -5,
      vibrato: { delay: 20, depth: 3, rate: 3 },
      gate: 0,
    }),
    preset("shimmer", "Shimmer", "A duty cycle pattern for a chorus feel", {
      duty: 2,
      volume: 10,
      env: 1,
      shimmer: true,
    }),
    preset("echo", "Soft echo", "Quiet 25% for echoes and backing", {
      duty: 1,
      volume: 6,
      env: 2,
      gate: 1,
    }),
    preset("slide", "Slide lead", "Notes that touch glide into each other", {
      duty: 1,
      volume: 11,
      env: 0,
      glide: 6,
      vibrato: { delay: 16, depth: 2, rate: 3 },
      gate: 0,
    }),
  ],
  wave: [
    preset("round", "Round bass", "A soft sine bass, full volume", {
      shape: "soft",
      volume: 15,
      gate: 1,
    }),
    preset("punch", "Punch bass", "Triangle bass with short notes", {
      shape: "triangle",
      volume: 15,
      gate: 2,
    }),
    preset("saw", "Saw bass", "Buzzy half-volume saw that steps down", {
      shape: "saw",
      volume: 8,
      env: 3,
      gate: 1,
    }),
    preset("pad", "Night pad", "Half-volume pad with a slow vibrato", {
      shape: "soft",
      volume: 8,
      vibrato: { delay: 20, depth: 3, rate: 5 },
      gate: 0,
    }),
    preset("organ", "Organ", "A few harmonics, held", {
      shape: "organ",
      volume: 8,
      gate: 0,
    }),
    preset("flute", "Hollow flute", "Odd harmonics, like a woodwind", {
      shape: "hollow",
      volume: 15,
      vibrato: { delay: 14, depth: 2, rate: 3 },
      gate: 0,
    }),
  ],
  noise: [
    preset("kit", "Classic kit", "Kick, snare, hats, toms, crash, shaker", { volume: 10 }),
    preset("tight", "Tight kit", "Darker and quieter, for calm songs", { volume: 8, tone: -1 }),
    preset("bright", "Bright kit", "Crisper and brighter, for battles", { volume: 10, tone: 1 }),
  ],
};

export function presetFor(kind: ChannelKind, id: string): Preset {
  return PRESETS[kind].find((p) => p.id === id) ?? PRESETS[kind][0]!;
}

export function instrument(kind: ChannelKind, id: string): Instrument {
  const inst = presetFor(kind, id).inst;
  return { ...inst, vibrato: { ...inst.vibrato } };
}

/** The noise channel's rows: drum names, top to bottom. Indices are the notes' `p`. */
export const DRUMS = [
  { name: "Crash", short: "CR" },
  { name: "Open hat", short: "OH" },
  { name: "Hi-hat", short: "HH" },
  { name: "Shaker", short: "SH" },
  { name: "High tom", short: "HT" },
  { name: "Low tom", short: "LT" },
  { name: "Snare", short: "SN" },
  { name: "Kick", short: "KK" },
] as const;

export const DRUM = {
  crash: 0,
  openHat: 1,
  hat: 2,
  shaker: 3,
  highTom: 4,
  lowTom: 5,
  snare: 6,
  kick: 7,
} as const;

export const DUTY_NAMES = ["12.5%", "25%", "50%", "75%"] as const;
