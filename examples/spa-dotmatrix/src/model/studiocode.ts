// The Studio's Code view: a song as music macros (songcode.ts), and a sound sheet in the SFX and
// voice format (code.ts), so the same code reads in the makers and in the Studio.
import { codeDialect, parseCode, type CodeError } from "./code.ts";
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

/**
 * Reads code back into a song or a sound sheet. The code decides which: sound-effect or cry code
 * opens as a sound sheet, song code opens as a song, and a file mixing both is one error. Code
 * applied over an open sheet keeps its kind, name and grid; a `fresh` import starts a new sheet
 * named `name` (a voice when the code has a cry header).
 */
export function readStudioCode(
  text: string,
  open: Song,
  options: { name?: string; fresh?: boolean } = {},
): { song: Song } | { errors: CodeError[] } {
  const current: Song = options.fresh ? { ...open, sheet: undefined } : open;
  const name = options.name ?? "Pasted sound";
  const dialect = codeDialect(text);
  if (dialect.kind === "mixed") return { errors: [dialect.error] };
  const asSheet = dialect.kind === "sfx" || (dialect.kind === "unknown" && !!current.sheet);
  if (!asSheet) return parseSong(text);
  const sheetName = current.sheet?.name ?? name;
  const parsed = parseCode(text, sheetName);
  if ("errors" in parsed) return parsed;
  const kind = current.sheet?.kind ?? (dialect.kind === "sfx" && dialect.voice ? "voice" : "sfx");
  const sheet = sfxToSheet(parsed.sfx, kind, current.sheet?.ticks ?? 1);
  if ("reasons" in sheet) return { errors: [{ line: 1, message: sheet.reasons.join(", ") }] };
  if (current.sheet) {
    sheet.song.title = current.title;
    // Trailing silence is not code: keep the sheet's own length unless the code needs more.
    sheet.song.bars = Math.max(sheet.song.bars, current.bars);
  }
  sheet.song.sheet = { ...sheet.song.sheet!, name: sheetName };
  return { song: sheet.song };
}
