// Application state: the song open in the studio (a deep store), its undo history, editor and
// view preferences, and the status line. Every song edit goes through `edit`, which records undo,
// autosaves and tells the player to re-render what changed.
//
// The app is prerendered: these modules also load at build time, where there is no browser
// storage. Every store starts from the same defaults on the server and in the browser (so
// hydration matches), and `loadSaved()` brings in what the browser stored once the app is mounted.
import { batch, computed, effect, signal, snapshot, store, untrack } from "lumiose";
import * as player from "./audio/player.ts";
import { createHistory } from "./model/history.ts";
import { loadCurrent, saveCurrent } from "./model/library.ts";
import { firstSteps } from "./model/songs/first-steps.ts";
import { clone } from "./model/song.ts";
import { CHANNELS, type ChannelIndex, type Song } from "./model/types.ts";

export const doc = store({ song: firstSteps() });

/** A plain copy of the open song (for the worker, saving and history). */
export const plainSong = (): Song => snapshot(doc.song);

// --- Status line ---

export const message = signal("");
let messageTimer: ReturnType<typeof setTimeout> | undefined;
export function say(text: string): void {
  message.set(text);
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => message.set(""), 4000);
}

// --- Editor state ---

export const editor = store({
  channel: 0 as ChannelIndex,
  /** Keyboard cursor on the grid: step and pitch (or drum index). */
  cursor: { step: 0, pitch: 72 },
  /** The selected bar, for the bar tools. */
  bar: 0,
  /** Lowest visible pitch per channel (the view spans two octaves and a bit). */
  low: [64, 55, 33, 0] as number[],
  /** The screen shows the note grid or the driver code. */
  view: "grid" as "grid" | "code",
});

export interface Prefs {
  theme: "system" | "light" | "dark";
  lcd: "pea" | "pocket" | "dusk" | "ice";
  /** Length of new notes, in steps. */
  noteLength: number;
}

const PREFS_KEY = "dotmatrix.prefs";
const defaults: Prefs = { theme: "system", lcd: "pea", noteLength: 2 };

function readPrefs(): Prefs {
  try {
    return {
      ...defaults,
      ...(JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<Prefs>),
    };
  } catch {
    return { ...defaults };
  }
}

export const prefs = store<Prefs>({ ...defaults });

let loaded = false;
/**
 * Brings in the open song and the preferences saved in this browser, then starts saving
 * preference changes. Called once, after the app has mounted (and hydrated): the first render
 * shows the defaults, as the prerendered HTML does.
 */
export function loadSaved(): void {
  if (loaded) return;
  loaded = true;
  const song = loadCurrent();
  batch(() => {
    if (song) doc.song = song;
    Object.assign(prefs, readPrefs());
  });
  effect(() => {
    const json = JSON.stringify(prefs);
    try {
      localStorage.setItem(PREFS_KEY, json);
    } catch {
      // Private mode or full storage: preferences just do not persist.
    }
  });
}

// --- Edits, history, autosave and audio ---

const historyVersion = signal(0);
const history = createHistory<Song>(() => historyVersion.update((v) => v + 1));
export const canUndo = computed(() => (historyVersion(), history.canUndo()));
export const canRedo = computed(() => (historyVersion(), history.canRedo()));

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let audioTimer: ReturnType<typeof setTimeout> | undefined;

function changed(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!saveCurrent(plainSong())) say("Could not autosave: browser storage is unavailable");
  }, 400);
  // Mix changes apply at once; note edits re-render after a short pause (dragging stays smooth).
  player.applyMix(plainSong(), "editor");
  clearTimeout(audioTimer);
  audioTimer = setTimeout(() => void player.update(plainSong(), "editor"), 60);
}

/**
 * An undoable song edit. `key` merges quick repeats (slider drags) into one undo step.
 */
export function edit(label: string, fn: (song: Song) => void, key?: string): void {
  const before = plainSong();
  untrack(() => batch(() => fn(doc.song)));
  history.push(before, label, key);
  changed();
}

/** Mixer moves (mute, solo, pan) are saved but not undoable: they are performance controls. */
export function mix(fn: (song: Song) => void): void {
  untrack(() => batch(() => fn(doc.song)));
  changed();
}

function restore(entry: { state: Song; label: string } | undefined, verb: string): void {
  if (!entry) return;
  batch(() => {
    doc.song = entry.state;
  });
  say(`${verb}: ${entry.label}`);
  changed();
}

export const undo = (): void => restore(history.undo(plainSong()), "Undo");
export const redo = (): void => restore(history.redo(plainSong()), "Redo");

/** Replaces the open song (a demo, a shared link, a saved song); undo brings the old one back. */
export function openSong(song: Song, label: string): void {
  const before = plainSong();
  const wasPlaying = player.nowPlaying.peek() === "editor";
  batch(() => {
    doc.song = clone(song);
    editor.bar = 0;
  });
  history.push(before, label);
  changed();
  if (wasPlaying) void player.play(plainSong(), "editor");
}

// --- Transport ---

export const editorPlaying = computed(() => player.nowPlaying() === "editor");

export function togglePlay(): void {
  if (editorPlaying()) player.stop();
  else
    void player
      .play(plainSong(), "editor")
      .catch((error: unknown) => say(`Audio failed: ${String(error)}`));
}

export const channelInfo = (ch: ChannelIndex) => CHANNELS[ch];
