// Saved songs in localStorage: the open song (autosaved) and the "My songs" shelf. Storage can be
// missing or full (private windows, quotas): every access is guarded and failures are reported.
import { sanitizeSong } from "./song.ts";
import type { Song } from "./types.ts";

const CURRENT = "dotmatrix.current";
const SHELF = "dotmatrix.songs";

export interface SavedSong {
  id: string;
  title: string;
  updated: number;
  song: Song;
}

function read(key: string): unknown {
  try {
    const text = localStorage.getItem(key);
    return text === null ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadCurrent(): Song | undefined {
  const data = read(CURRENT);
  if (data === undefined) return undefined;
  try {
    return sanitizeSong(data);
  } catch {
    return undefined;
  }
}

export const saveCurrent = (song: Song): boolean => write(CURRENT, song);

export function loadShelf(): SavedSong[] {
  const data = read(SHELF);
  if (!Array.isArray(data)) return [];
  return data.flatMap((entry: Partial<SavedSong>) => {
    try {
      const song = sanitizeSong(entry.song);
      return [
        { id: String(entry.id), title: song.title, updated: Number(entry.updated) || 0, song },
      ];
    } catch {
      return [];
    }
  });
}

export function saveShelf(entries: SavedSong[]): boolean {
  return write(SHELF, entries);
}

export const newId = (): string => Math.random().toString(36).slice(2, 10);

// --- My sounds: sound sheets saved from the studio ---

const SOUNDS = "dotmatrix.sounds";

export interface SavedSound {
  id: string;
  kind: "sfx" | "voice";
  name: string;
  updated: number;
  song: Song;
}

export function loadSounds(): SavedSound[] {
  const data = read(SOUNDS);
  if (!Array.isArray(data)) return [];
  return data.flatMap((entry: Partial<SavedSound>) => {
    try {
      const song = sanitizeSong(entry.song);
      if (!song.sheet) return [];
      return [
        {
          id: String(entry.id),
          kind: song.sheet.kind,
          name: song.sheet.name,
          updated: Number(entry.updated) || 0,
          song,
        },
      ];
    } catch {
      return [];
    }
  });
}

export const saveSounds = (entries: SavedSound[]): boolean => write(SOUNDS, entries);
