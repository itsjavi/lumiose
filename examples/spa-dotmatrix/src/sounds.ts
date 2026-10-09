// Sounds shared by the SFX and Creatures pages and the studio: rendering a sound for its
// waveform, opening it in the studio as a sound sheet, and the "My sounds" shelf.
import { href, signal } from "lumen";
import { navigate } from "lumen/router";
import type { EngineAudioData } from "../vendor/gbapu/dist/index.js";
import { songData } from "./audio/driver.ts";
import { monoWav } from "./audio/player.ts";
import { renderPcm } from "./audio/renderer.ts";
import { loadSounds, newId, saveSounds, type SavedSound } from "./model/library.ts";
import { sfxToSheet } from "./model/sheet.ts";
import type { Sfx, Song, SoundSheet } from "./model/types.ts";
import { editor, openSong, say } from "./state.ts";
import { download, slug } from "./files.ts";

export const mySounds = signal<SavedSound[]>(loadSounds());

export const renderSound = (data: EngineAudioData): Promise<Float32Array> =>
  renderPcm(data, { mono: true });

/** A sound sheet as engine data: every channel, played once. */
export const sheetData = (song: Song): EngineAudioData => songData(song, [0, 1, 2, 3]);

export async function saveWav(pcm: Float32Array, name: string): Promise<void> {
  try {
    download(await monoWav(pcm), `${slug(name)}.wav`);
    say(`Saved ${slug(name)}.wav`);
  } catch (error) {
    say(`WAV export failed: ${String(error)}`);
  }
}

/** Opens a sound in the studio, on a frame grid. */
export function openInStudio(sfx: Sfx, kind: SoundSheet["kind"]): void {
  const result = sfxToSheet(sfx, kind);
  if ("reasons" in result) {
    say(`“${sfx.name}” cannot open in the studio: ${result.reasons.join("; ")}`);
    return;
  }
  openInStudioSheet(result.song, `Open ${sfx.name} in the studio`);
}

export function openInStudioSheet(song: Song, label: string): void {
  openSong(song, label);
  const first = song.tracks.findIndex((t) => t.notes.length > 0);
  editor.channel = (first < 0 ? 0 : first) as 0 | 1 | 2 | 3;
  editor.bar = 0;
  // Show each pitched channel's notes: the grid starts at its lowest note.
  song.tracks.forEach((t, c) => {
    if (c < 3 && t.notes.length)
      editor.low[c] = Math.max(24, Math.min(...t.notes.map((n) => n.p)) - 1);
  });
  say(
    `${song.title}: one step is one frame. Notes with a notch keep their own settings. Undo brings your song back.`,
  );
  void navigate(href("/"));
}

/** Saves the studio's sound sheet to My sounds and returns its id. */
export function keepSound(song: Song): string | undefined {
  if (!song.sheet) return undefined;
  const entry: SavedSound = {
    id: newId(),
    kind: song.sheet.kind,
    name: song.sheet.name,
    updated: Date.now(),
    song,
  };
  const next = [entry, ...mySounds()].slice(0, 60);
  if (!saveSounds(next)) {
    say("Could not save: browser storage is unavailable");
    return undefined;
  }
  mySounds.set(next);
  return entry.id;
}

export function forgetSound(id: string): void {
  const next = mySounds().filter((s) => s.id !== id);
  if (saveSounds(next)) mySounds.set(next);
}
