// File import/export: JSON song files and WAV rendering.
import { signal } from "lumen";
import { renderWav } from "./audio/engine.ts";
import { deserialize, serialize } from "./model/library.ts";
import { clone } from "./model/song.ts";
import { openSong, readSong, say } from "./state.ts";

export const exporting = signal(false);

const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "song";

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function exportWav(): Promise<void> {
  if (exporting()) return;
  exporting.set(true);
  say("Rendering WAV…");
  const started = performance.now();
  try {
    const song = clone(readSong());
    const blob = await renderWav(song);
    download(blob, `${slug(song.title)}.wav`);
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    say(`Exported ${(blob.size / 1024 / 1024).toFixed(1)} MB WAV in ${seconds} s`);
  } catch (error) {
    say(`WAV export failed: ${String(error)}`);
  } finally {
    exporting.set(false);
  }
}

export function exportJson(): void {
  const song = readSong();
  download(
    new Blob([serialize(song)], { type: "application/json" }),
    `${slug(song.title)}.chip.json`,
  );
  say("Song file saved");
}

export async function importJson(file: File): Promise<void> {
  try {
    openSong(deserialize(await file.text()));
    say(`Opened ${file.name}`);
  } catch (error) {
    say(`Could not open ${file.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
