// Song factories, formatting and path helpers. Pure functions over plain data.
import {
  CHANNEL_COUNT,
  CHANNELS,
  NOTE_CUT,
  NOTE_EMPTY,
  NOTE_OFF,
  type Cell,
  type Instrument,
  type Macro,
  type Mixer,
  type Path,
  type Pattern,
  type Song,
} from "./types.ts";

export const emptyCell = (): Cell => ({ note: NOTE_EMPTY, inst: -1, vol: -1, fx: "", param: 0 });

export const isEmptyCell = (cell: Cell): boolean =>
  cell.note === NOTE_EMPTY && cell.inst < 0 && cell.vol < 0 && cell.fx === "";

export function emptyPattern(length: number): Pattern {
  return {
    rows: Array.from({ length }, () => Array.from({ length: CHANNEL_COUNT }, emptyCell)),
  };
}

export const macro = (values: number[] = [], loop = -1, release = -1): Macro => ({
  values,
  loop,
  release,
});

export function instrument(name: string, parts: Partial<Omit<Instrument, "name">> = {}): Instrument {
  return {
    name,
    volume: parts.volume ?? macro(),
    arpeggio: parts.arpeggio ?? macro(),
    pitch: parts.pitch ?? macro(),
    duty: parts.duty ?? macro(),
  };
}

export function defaultMixer(): Mixer {
  return {
    channels: CHANNELS.map((_, i) => ({
      volume: 0.8,
      pan: [-0.3, 0.3, 0, 0][i] ?? 0,
      mute: false,
      solo: false,
    })),
    master: 0.8,
  };
}

export function emptySong(): Song {
  return {
    title: "Untitled",
    author: "",
    bpm: 150,
    speed: 6,
    rowsPerBeat: 4,
    patternLength: 64,
    patterns: [emptyPattern(64)],
    order: [0],
    instruments: [
      instrument("Lead", { volume: macro([15, 13, 12, 11, 10], -1, -1), duty: macro([2]) }),
    ],
    mixer: defaultMixer(),
  };
}

// --- Notes and numbers ---

const NAMES = ["C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-"];
const HEX = "0123456789ABCDEF";

export const hex = (value: number, digits = 2): string =>
  value.toString(16).toUpperCase().padStart(digits, "0");

export const hexDigit = (value: number): string => HEX[value & 15]!;

/** "C-4", "F#2", "OFF", "^^^" (cut), "---" (empty); noise notes show their pitch, "3-#". */
export function noteName(note: number, noise = false): string {
  if (note === NOTE_EMPTY) return "···";
  if (note === NOTE_OFF) return "===";
  if (note === NOTE_CUT) return "^^^";
  if (noise) return `${hexDigit(note % 16)}-#`;
  return `${NAMES[note % 12]}${Math.floor(note / 12)}`;
}

/** Frequency of a pitch given in 1/16 semitones (A-4 = note 57 = 440 Hz). */
export const pitchToHz = (pitch16: number): number => 440 * 2 ** ((pitch16 / 16 - 57) / 12);

// --- Paths ---

export function getAt(root: unknown, path: Path): unknown {
  let node = root as Record<string | number, unknown>;
  for (const key of path) node = node[key] as Record<string | number, unknown>;
  return node;
}

/**
 * Writes `value` at `path`. Writing `undefined` to an array index truncates the array there, so
 * undoing an append (whose `before` is undefined) removes the item instead of leaving a hole.
 */
export function setAt(root: unknown, path: Path, value: unknown): void {
  const parent = getAt(root, path.slice(0, -1)) as Record<string | number, unknown>;
  const key = path[path.length - 1]!;
  if (value === undefined && Array.isArray(parent)) parent.length = Number(key);
  else parent[key] = value;
}

/** A deep copy of plain JSON data (works on store proxies, unlike structuredClone). */
export const clone = <T>(value: T): T =>
  value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
