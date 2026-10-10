// Application state: the open song (a deep store), the undo history, the editor cursor and
// preferences. Every song write goes through `write`, which updates the store (and so the UI),
// the audio engine and the autosave.
import { batch, computed, effect, signal, store, untrack } from "lumiose";
import * as engine from "./audio/engine.ts";
import { demoSong } from "./model/demo.ts";
import { createHistory } from "./model/history.ts";
import { lastOpened, loadSaved, markOpened, newId, saveSong } from "./model/library.ts";
import { clone, getAt, setAt } from "./model/song.ts";
import type { Path, Song } from "./model/types.ts";

export interface CursorState {
  order: number;
  row: number;
  channel: number;
  /** 0 note, 1-2 instrument digits, 3 volume, 4 effect, 5-6 effect parameter digits. */
  column: number;
}

// The raw object stays plain JSON (the store writes raw values through), so it can be cloned,
// posted to the worklet and serialized without unwrapping proxies.
const raw = { song: demoSong() };
export const doc = store(raw);

export const songId = signal(newId());
export const cursor = store<CursorState>({ order: 0, row: 0, channel: 0, column: 0 });

export interface Prefs {
  octave: number;
  instrument: number;
  step: number;
  record: boolean;
  follow: boolean;
  theme: "nes" | "dmg";
  perf: boolean;
}

const PREFS_KEY = "chiptune.prefs";
const defaults: Prefs = {
  octave: 4,
  instrument: 0,
  step: 1,
  record: true,
  follow: true,
  theme: "nes",
  perf: true,
};

function readPrefs(): Prefs {
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as object) };
  } catch {
    return { ...defaults };
  }
}

export const prefs = store<Prefs>(readPrefs());

effect(() => {
  const json = JSON.stringify(prefs);
  try {
    localStorage.setItem(PREFS_KEY, json);
  } catch {
    // Private mode or full storage: preferences just do not persist.
  }
});

// --- Status line ---

export const message = signal("");
let messageTimer: ReturnType<typeof setTimeout> | undefined;
export function say(text: string): void {
  message.set(text);
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => message.set(""), 3500);
}

// --- Writes, history and autosave ---

export const saved = signal(true);
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleSave(): void {
  saved.set(false);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 600);
}

export function saveNow(): void {
  clearTimeout(saveTimer);
  if (saveSong(songId.peek(), raw.song)) saved.set(true);
}

function write(path: Path, value: unknown): void {
  untrack(() => setAt(doc.song, path, value));
  engine.send({ type: "set", path, value });
  scheduleSave();
}

export const history = createHistory<CursorState>({
  read: (path) => getAt(raw.song, path),
  write,
});

/** Song edits: undoable, and the cursor returns to where they happened on undo. */
export function edit(label: string, fn: () => void, key?: string): void {
  history.transact(label, fn, { key, meta: { ...cursor } });
}

export const set = (path: Path, value: unknown): void => history.set(path, value);

/** Mixer moves are not undoable (they are performance controls), but they are saved. */
export function setMix(path: Path, value: unknown): void {
  write(["mixer", ...path], value);
}

export function undo(): void {
  restore(history.undo(), "Undo");
}

export function redo(): void {
  restore(history.redo(), "Redo");
}

function restore(entry: ReturnType<typeof history.undo>, verb: string): void {
  if (!entry) return;
  if (entry.meta) Object.assign(cursor, clampCursor(entry.meta));
  say(`${verb}: ${entry.label}`);
}

engine.setSongSource(() => clone(raw.song));

/** Opens a song: replaces the document, resets history and the cursor, tells the engine. */
export function openSong(song: Song, id = newId()): void {
  engine.stop();
  batch(() => {
    doc.song = song;
    songId.set(id);
    Object.assign(cursor, { order: 0, row: 0, channel: 0, column: 0 });
    prefs.instrument = 0;
  });
  history.clear();
  engine.send({ type: "song", song: clone(raw.song) });
  saved.set(true);
  markOpened(id);
}

/** Reopens the last song, or saves the demo as the first one. */
export function restoreSession(): void {
  const id = lastOpened();
  const song = id ? loadSaved(id) : undefined;
  if (id && song) openSong(song, id);
  else saveNow();
}

export function readSong(): Song {
  return raw.song;
}

// --- Derived editor state ---

export const patternIndex = computed(() => doc.song.order[cursor.order] ?? 0);
export const pattern = computed(() => doc.song.patterns[patternIndex()]);

export function clampCursor(c: CursorState): CursorState {
  const song = raw.song;
  return {
    order: Math.min(Math.max(c.order, 0), song.order.length - 1),
    row: Math.min(Math.max(c.row, 0), song.patternLength - 1),
    channel: Math.min(Math.max(c.channel, 0), 3),
    column: Math.min(Math.max(c.column, 0), 6),
  };
}
