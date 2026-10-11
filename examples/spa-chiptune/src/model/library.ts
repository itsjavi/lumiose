// Save files and the song library in localStorage.
import { signal } from "lumiose";
import {
  defaultMixer,
  emptyCell,
  emptyPattern,
  emptySong,
  instrument,
  isEmptyCell,
} from "./song.ts";
import { CHANNEL_COUNT, type Cell, type Instrument, type Macro, type Song } from "./types.ts";

export const FORMAT = "lumiose-chiptune";

/** [row, channel, note, inst, vol, fx, param]: only non-empty cells are stored. */
type SparseCell = [number, number, number, number, number, string, number];

interface SongFile {
  format: typeof FORMAT;
  version: 1;
  song: Omit<Song, "patterns"> & { patterns: SparseCell[][] };
}

export function serialize(song: Song): string {
  const file: SongFile = {
    format: FORMAT,
    version: 1,
    song: {
      ...song,
      patterns: song.patterns.map((pattern) => {
        const cells: SparseCell[] = [];
        pattern.rows.forEach((row, r) =>
          row.forEach((cell, c) => {
            if (!isEmptyCell(cell))
              cells.push([r, c, cell.note, cell.inst, cell.vol, cell.fx, cell.param]);
          }),
        );
        return cells;
      }),
    },
  };
  return JSON.stringify(file);
}

const int = (value: unknown, lo: number, hi: number, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(hi, Math.max(lo, Math.round(value)))
    : fallback;

function readMacro(value: unknown, lo: number, hi: number): Macro {
  const m = (value ?? {}) as Partial<Macro>;
  const values = Array.isArray(m.values) ? m.values.slice(0, 64).map((v) => int(v, lo, hi, 0)) : [];
  return {
    values,
    loop: int(m.loop, -1, values.length - 1, -1),
    release: int(m.release, -1, values.length - 1, -1),
  };
}

/** Parses a save file, clamping every value into range. Throws on a file of another format. */
export function deserialize(text: string): Song {
  const file = JSON.parse(text) as Partial<SongFile>;
  if (file.format !== FORMAT || !file.song) throw new Error("Not a Lumiose chiptune song file");
  const s = file.song;
  const base = emptySong();
  const length = int(s.patternLength, 8, 128, 64);
  const patterns = (Array.isArray(s.patterns) ? s.patterns : [[]]).slice(0, 128).map((cells) => {
    const pattern = emptyPattern(length);
    for (const item of Array.isArray(cells) ? cells : []) {
      const [r, c, note, inst, vol, fx, param] = item;
      const cell: Cell | undefined = pattern.rows[r]?.[c];
      if (!cell || c >= CHANNEL_COUNT) continue;
      Object.assign(cell, emptyCell(), {
        note: int(note, -1, 97, -1),
        inst: int(inst, -1, 255, -1),
        vol: int(vol, -1, 15, -1),
        fx: typeof fx === "string" ? fx.slice(0, 1).toUpperCase() : "",
        param: int(param, 0, 255, 0),
      });
    }
    return pattern;
  });
  const instruments: Instrument[] = (
    Array.isArray(s.instruments) ? s.instruments : base.instruments
  )
    .slice(0, 64)
    .map((ins) => ({
      ...instrument(typeof ins?.name === "string" ? ins.name.slice(0, 32) : "Instrument"),
      volume: readMacro(ins?.volume, 0, 15),
      arpeggio: readMacro(ins?.arpeggio, -12, 12),
      pitch: readMacro(ins?.pitch, -32, 32),
      duty: readMacro(ins?.duty, 0, 3),
    }));
  const mixer = defaultMixer();
  s.mixer?.channels?.forEach((channel, i) => {
    const target = mixer.channels[i];
    if (!target) return;
    target.volume = Math.min(1, Math.max(0, Number(channel.volume) || 0));
    target.pan = Math.min(1, Math.max(-1, Number(channel.pan) || 0));
    target.mute = channel.mute === true;
    target.solo = channel.solo === true;
  });
  if (typeof s.mixer?.master === "number") mixer.master = Math.min(1, Math.max(0, s.mixer.master));
  const order = (Array.isArray(s.order) && s.order.length ? s.order : [0])
    .slice(0, 256)
    .map((p) => int(p, 0, patterns.length - 1, 0));
  return {
    title: typeof s.title === "string" ? s.title.slice(0, 64) : "Untitled",
    author: typeof s.author === "string" ? s.author.slice(0, 64) : "",
    bpm: int(s.bpm, 32, 255, 150),
    speed: int(s.speed, 1, 31, 6),
    rowsPerBeat: int(s.rowsPerBeat, 1, 16, 4),
    patternLength: length,
    patterns,
    order,
    instruments: instruments.length ? instruments : base.instruments,
    mixer,
  };
}

// --- Library (localStorage) ---

export interface LibraryEntry {
  id: string;
  title: string;
  author: string;
  updated: number;
  orders: number;
  patterns: number;
}

const INDEX = "chiptune.library.v1";
const SONG = (id: string) => `chiptune.song.${id}`;
const CURRENT = "chiptune.current";

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function readIndex(): LibraryEntry[] {
  try {
    const list: unknown = JSON.parse(storage()?.getItem(INDEX) ?? "[]");
    return Array.isArray(list) ? (list as LibraryEntry[]) : [];
  } catch {
    return [];
  }
}

/** The saved songs, most recently updated first: empty until `refreshLibrary()` reads storage. */
export const library = signal<LibraryEntry[]>([]);

/** Reads the library from storage (in the browser, once the prerendered page has hydrated). */
export function refreshLibrary(): void {
  library.set(readIndex());
}

function writeIndex(list: LibraryEntry[]): void {
  list.sort((a, b) => b.updated - a.updated);
  library.set([...list]);
  storage()?.setItem(INDEX, JSON.stringify(list));
}

export const newId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Saves a song under `id`; returns false when storage is unavailable or full. */
export function saveSong(id: string, song: Song): boolean {
  try {
    const store = storage();
    if (!store) return false;
    store.setItem(SONG(id), serialize(song));
    store.setItem(CURRENT, id);
    const entry: LibraryEntry = {
      id,
      title: song.title,
      author: song.author,
      updated: Date.now(),
      orders: song.order.length,
      patterns: song.patterns.length,
    };
    writeIndex([entry, ...readIndex().filter((e) => e.id !== id)]);
    return true;
  } catch {
    return false;
  }
}

export function loadSaved(id: string): Song | undefined {
  try {
    const text = storage()?.getItem(SONG(id));
    return text ? deserialize(text) : undefined;
  } catch {
    return undefined;
  }
}

export function deleteSaved(id: string): void {
  storage()?.removeItem(SONG(id));
  writeIndex(readIndex().filter((e) => e.id !== id));
}

/** Remembers the open song for the next session. */
export function markOpened(id: string): void {
  try {
    storage()?.setItem(CURRENT, id);
  } catch {
    // Storage unavailable: the next session starts from the demo.
  }
}

export function lastOpened(): string | undefined {
  return storage()?.getItem(CURRENT) ?? undefined;
}
