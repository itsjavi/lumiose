// The Studio's Code view: a song as music macros (songcode.ts), and a sound sheet in the SFX and
// voice format (code.ts), so the same code reads in the makers and in the Studio.
import { parseCode, type CodeError } from "./code.ts";
import { listing } from "./sfx.ts";
import { sfxToSheet, sheetToSfx } from "./sheet.ts";
import { exportSong, parseSong } from "./songcode.ts";
import type { Song } from "./types.ts";

/** The code for what the Studio has open, or why a sheet has none. */
export function studioCode(song: Song): { text: string } | { reasons: string[] } {
  if (!song.sheet) return { text: exportSong(song) };
  const back = sheetToSfx(song, "studio");
  return "sfx" in back ? { text: listing(back.sfx) } : back;
}

/** Reads code back into a song (or a sound sheet, keeping the open sheet's kind, name and grid). */
export function readStudioCode(
  text: string,
  current: Song,
): { song: Song } | { errors: CodeError[] } {
  if (!current.sheet) return parseSong(text);
  const parsed = parseCode(text, current.sheet.name);
  if ("errors" in parsed) return parsed;
  const sheet = sfxToSheet(parsed.sfx, current.sheet.kind, current.sheet.ticks);
  if ("reasons" in sheet) return { errors: [{ line: 1, message: sheet.reasons.join(", ") }] };
  sheet.song.title = current.title;
  // Trailing silence is not code: keep the sheet's own length unless the code needs more.
  sheet.song.bars = Math.max(sheet.song.bars, current.bars);
  sheet.song.sheet = { ...sheet.song.sheet!, name: current.sheet.name };
  return { song: sheet.song };
}
