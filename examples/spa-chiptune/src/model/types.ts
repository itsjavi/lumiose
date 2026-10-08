// The song document: plain JSON data shared by the UI (inside a store()), the audio engine (a
// plain copy in the AudioWorklet) and the save files.

export type ChannelKind = "pulse" | "triangle" | "noise";

export interface ChannelInfo {
  kind: ChannelKind;
  name: string;
  short: string;
}

/** The four NES-style voices, in pattern column order. */
export const CHANNELS: readonly ChannelInfo[] = [
  { kind: "pulse", name: "Pulse 1", short: "PU1" },
  { kind: "pulse", name: "Pulse 2", short: "PU2" },
  { kind: "triangle", name: "Triangle", short: "TRI" },
  { kind: "noise", name: "Noise", short: "NOI" },
];
export const CHANNEL_COUNT = CHANNELS.length;

/** `note` values: -1 empty, 0..95 C-0..B-7, then the two control notes. */
export const NOTE_EMPTY = -1;
export const NOTE_OFF = 96;
export const NOTE_CUT = 97;
export const NOTE_MAX = 95;

/** Effect commands, FamiTracker style: they persist until set to 00 (except B, D, F, S). */
export const EFFECTS = {
  "0": "Arpeggio 0xy: base, +x, +y semitones",
  "1": "Slide up 1xx: xx/16 semitone per tick",
  "2": "Slide down 2xx: xx/16 semitone per tick",
  "3": "Portamento 3xx: glide to the new note",
  "4": "Vibrato 4xy: speed x, depth y",
  A: "Volume slide Axy: up x, down y per tick",
  B: "Jump Bxx: to order xx after this row",
  D: "Break Dxx: next order, at row xx",
  F: "Speed Fxx: below 20 ticks per row, else BPM",
  S: "Cut Sxx: silence the note after xx ticks",
  V: "Duty Vxx: pulse 0-3 (12.5/25/50/75%), noise 0-1",
} as const;
export type EffectCode = keyof typeof EFFECTS;
export const EFFECT_CODES = Object.keys(EFFECTS) as EffectCode[];

export interface Cell {
  /** -1 empty, 0..95 a note, NOTE_OFF (release) or NOTE_CUT. */
  note: number;
  /** -1 empty, else the instrument index. */
  inst: number;
  /** -1 empty, else 0..15. */
  vol: number;
  /** "" empty, else an EffectCode. */
  fx: string;
  /** 0..255. */
  param: number;
}

export interface Pattern {
  /** rows[row][channel] */
  rows: Cell[][];
}

/** A per-tick sequence with an optional loop point and release point (indices, -1 for none). */
export interface Macro {
  values: number[];
  loop: number;
  release: number;
}

export type MacroKind = "volume" | "arpeggio" | "pitch" | "duty";

export const MACROS: readonly { kind: MacroKind; label: string; min: number; max: number }[] = [
  { kind: "volume", label: "Volume", min: 0, max: 15 },
  { kind: "arpeggio", label: "Arpeggio", min: -12, max: 12 },
  { kind: "pitch", label: "Pitch", min: -32, max: 32 },
  { kind: "duty", label: "Duty", min: 0, max: 3 },
];

export interface Instrument {
  name: string;
  /** 0..15 per tick, scaled by the channel volume. */
  volume: Macro;
  /** Semitone offsets from the note, per tick. */
  arpeggio: Macro;
  /** Relative pitch per tick, in 1/16 semitones, accumulated. */
  pitch: Macro;
  /** Pulse duty 0..3 (12.5/25/50/75%) or noise mode 0..1 (long/short). */
  duty: Macro;
}

export interface ChannelMix {
  /** 0..1 */
  volume: number;
  /** -1 (left) .. 1 (right) */
  pan: number;
  mute: boolean;
  solo: boolean;
}

export interface Mixer {
  channels: ChannelMix[];
  /** 0..1 */
  master: number;
}

export interface Song {
  title: string;
  author: string;
  /** Tempo: one tick lasts 2.5 / bpm seconds (ProTracker timing). */
  bpm: number;
  /** Ticks per row. */
  speed: number;
  /** Rows per beat, for the editor's highlight. */
  rowsPerBeat: number;
  /** Rows per pattern (every pattern has this length). */
  patternLength: number;
  patterns: Pattern[];
  /** The arrangement: pattern indices, played in order. */
  order: number[];
  instruments: Instrument[];
  mixer: Mixer;
}

/** A path into the song, such as ["patterns", 0, "rows", 4, 1, "note"]. */
export type Path = readonly (string | number)[];
