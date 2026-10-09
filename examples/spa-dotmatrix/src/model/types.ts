// The song and SFX data model. Songs are plain JSON (they go to the worker, the URL and
// localStorage as they are): four tracks, one per Game Boy channel, each a list of notes on a
// 16th-note step grid, plus one instrument per track.

/** The four channels of the Game Boy APU, in register order. */
export const CHANNELS = [
  { kind: "pulse", name: "Pulse 1", short: "P1", role: "Lead", hw: 1 },
  { kind: "pulse", name: "Pulse 2", short: "P2", role: "Harmony", hw: 2 },
  { kind: "wave", name: "Wave", short: "WV", role: "Bass", hw: 3 },
  { kind: "noise", name: "Noise", short: "NS", role: "Drums", hw: 4 },
] as const;

export type ChannelIndex = 0 | 1 | 2 | 3;
export type ChannelKind = (typeof CHANNELS)[number]["kind"];

/** Steps per bar: 16th notes in 4/4. */
export const STEPS_PER_BAR = 16;
export const MAX_BARS = 32;

/**
 * A note on the grid. `p` is a MIDI note number on the pulse and wave channels, and a drum index
 * (see DRUMS) on the noise channel. Drums are one-shots: their length is always 1.
 */
export interface Note {
  /** First step, counted from the start of the song. */
  s: number;
  /** Length in steps. */
  l: number;
  p: number;
  // Per-note settings that override the track's instrument. Only sound sheets (sound effects and
  // creature voices opened in the studio) carry them, so a sound keeps every detail.
  /** Start volume, 0–15. */
  v?: number;
  /** Envelope, as Instrument.env. */
  e?: number;
  /** Pulse duty, 0–3. */
  d?: number;
  /** Pulse 1 hardware sweep, as SfxNote.sweep. */
  w?: number;
  /** Fine tuning in semitones (-0.5…0.5): sounds can sit between the grid's rows. */
  t?: number;
  /** Pulse duty cycle pattern (as SfxNote.pattern). */
  dp?: number;
  /** Frequency slide in register units per frame (as SfxNote.slide). */
  sl?: number;
}

/** The note settings that override the instrument. */
export const NOTE_OVERRIDES = ["v", "e", "d", "w", "t", "dp", "sl"] as const;

export type ArpId = "off" | "major" | "minor" | "fifth" | "octave";
export type WaveShape = "soft" | "triangle" | "saw" | "square" | "organ" | "hollow";
export type Gate = 0 | 1 | 2;

/**
 * One instrument per track. Every channel reads the fields that make sense for it: pulses use
 * duty/shimmer, the wave channel uses shape, noise uses tone; the rest are shared.
 */
export interface Instrument {
  /** The preset it started from (shown in the picker; editing a field keeps it). */
  preset: string;
  /** Pulse duty cycle: 0 = 12.5 %, 1 = 25 %, 2 = 50 %, 3 = 75 %. */
  duty: number;
  /** Start volume, 0–15. On the wave channel it picks the output level (100/50/25 %). */
  volume: number;
  /** Envelope: 0 holds, 1–7 fades out (7 fastest), -1…-7 swells in (-7 fastest). */
  env: number;
  /** Vibrato after `delay` frames, `depth` in 6-cent units, `rate` frames per quarter swing. */
  vibrato: { delay: number; depth: number; rate: number };
  /** Frames to slide from the previous note when notes touch (0 = off). */
  glide: number;
  /** Frame-rate arpeggio over each note (a chord from one note). */
  arp: ArpId;
  /** Rotate the duty cycle every frame (a duty cycle pattern): a chorus-like shimmer. */
  shimmer: boolean;
  /** How long notes sound: 0 legato (full), 1 normal (80 %), 2 short (45 %). */
  gate: Gate;
  /** Wave channel table. */
  shape: WaveShape;
  /** Noise: drum brightness offset, -3 (darker) … 3 (brighter). */
  tone: number;
}

export type Pan = "L" | "C" | "R";

export interface Track {
  inst: Instrument;
  notes: Note[];
  mute: boolean;
  solo: boolean;
  pan: Pan;
}

export type ScaleId =
  | "major"
  | "minor"
  | "harmonicMinor"
  | "dorian"
  | "pentatonic"
  | "minorPentatonic"
  | "chromatic";

export interface Song {
  v: 1;
  title: string;
  author: string;
  bpm: number;
  bars: number;
  /** The bar the song loops back to (bars before it are an intro, played once). */
  loop: number;
  /** Key root, 0 = C … 11 = B. With `scale`, it decides the grid rows. */
  key: number;
  scale: ScaleId;
  tracks: [Track, Track, Track, Track];
  /**
   * Set when the song is a sound sheet: a sound effect or creature voice opened in the studio. Its
   * steps are `ticks` video frames long (not 16th notes at `bpm`), it plays once, and on the noise
   * channel `p` is the raw noise setting (NR43) instead of a drum.
   */
  sheet?: SoundSheet;
}

export interface SoundSheet {
  kind: "sfx" | "voice";
  name: string;
  /** Video frames per step. */
  ticks: number;
}

// --- SFX ---

/** One SFX step: Crystal's `square_note` / `noise_note`, with a pitch instead of a register. */
export interface SfxNote {
  frames: number;
  volume: number;
  /** Envelope, as Instrument.env. */
  env: number;
  /** Pulse: MIDI pitch (fractions allowed). Noise: ignored. */
  pitch: number;
  /** Pulse: duty 0–3. */
  duty: number;
  /** Pulse 1 only: hardware sweep, -7 (falls fast) … 7 (rises fast), 0 = off. */
  sweep: number;
  /** Noise: NR43 polynomial counter byte (clock shift, width, divisor). */
  noise: number;
  /**
   * Pulse: a duty cycle pattern, four 2-bit duties (first in the high bits) that rotate every
   * frame, as the original drivers' duty_cycle_pattern. Overrides `duty`.
   */
  pattern?: number;
  /** Pulse: slide the frequency register by this much every frame, without retriggering. */
  slide?: number;
}

export interface SfxVoice {
  /** 0 pulse 1, 1 pulse 2, 3 noise. */
  channel: 0 | 1 | 3;
  notes: SfxNote[];
}

export interface Sfx {
  id: string;
  name: string;
  blurb: string;
  voices: SfxVoice[];
}
