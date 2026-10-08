// Pattern editor commands: cursor movement, selection and every cell edit, all undoable.
import { batch, signal } from "lumen";
import * as engine from "./audio/engine.ts";
import { clone, emptyCell, emptyPattern } from "./model/song.ts";
import {
  CHANNEL_COUNT,
  CHANNELS,
  EFFECT_CODES,
  NOTE_CUT,
  NOTE_EMPTY,
  NOTE_MAX,
  NOTE_OFF,
  type Cell,
} from "./model/types.ts";
import { clampCursor, cursor, doc, edit, patternIndex, prefs, readSong, say, set } from "./state.ts";

/** Character offset and width of each cursor column inside a 14ch cell. */
export const COLUMNS = [
  { x: 1, w: 3, field: "note" },
  { x: 5, w: 1, field: "inst" },
  { x: 6, w: 1, field: "inst" },
  { x: 8, w: 1, field: "vol" },
  { x: 10, w: 1, field: "fx" },
  { x: 11, w: 1, field: "param" },
  { x: 12, w: 1, field: "param" },
] as const;
export const CELL_CH = 14;
export const ROWNUM_CH = 4;

export interface Selection {
  /** Anchor and head, in rows and channels (inclusive, any order). */
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export const selection = signal<Selection | null>(null);

export function selectionBounds(sel: Selection) {
  return {
    top: Math.min(sel.r1, sel.r2),
    bottom: Math.max(sel.r1, sel.r2),
    left: Math.min(sel.c1, sel.c2),
    right: Math.max(sel.c1, sel.c2),
  };
}

const rows = () => readSong().patternLength;
const cellPath = (row: number, channel: number) => [
  "patterns",
  patternIndex(),
  "rows",
  row,
  channel,
];
const currentCell = (row = cursor.row, channel = cursor.channel): Cell =>
  readSong().patterns[patternIndex()]!.rows[row]![channel]!;

// --- Cursor ---

export function moveTo(row: number, channel = cursor.channel, column = cursor.column): void {
  const length = rows();
  Object.assign(
    cursor,
    clampCursor({ ...cursor, row: ((row % length) + length) % length, channel, column }),
  );
}

export function moveRows(delta: number, extend = false): void {
  const from = { row: cursor.row, channel: cursor.channel };
  const length = rows();
  // Moving past either end wraps like a tracker; selection extension clamps instead.
  const row = extend ? Math.min(Math.max(cursor.row + delta, 0), length - 1) : cursor.row + delta;
  moveTo(row);
  track(from, extend);
}

export function moveColumns(delta: number): void {
  selection.set(null);
  let column = cursor.column + delta;
  let channel = cursor.channel;
  if (column < 0) {
    channel = (channel + CHANNEL_COUNT - 1) % CHANNEL_COUNT;
    column = COLUMNS.length - 1;
  } else if (column >= COLUMNS.length) {
    channel = (channel + 1) % CHANNEL_COUNT;
    column = 0;
  }
  moveTo(cursor.row, channel, column);
}

export function moveChannel(delta: number, extend = false): void {
  const from = { row: cursor.row, channel: cursor.channel };
  const channel = extend
    ? Math.min(Math.max(cursor.channel + delta, 0), CHANNEL_COUNT - 1)
    : (cursor.channel + delta + CHANNEL_COUNT) % CHANNEL_COUNT;
  moveTo(cursor.row, channel, extend ? cursor.column : 0);
  track(from, extend);
}

function track(from: { row: number; channel: number }, extend: boolean): void {
  if (!extend) {
    selection.set(null);
    return;
  }
  const current = selection();
  selection.set({
    r1: current?.r1 ?? from.row,
    c1: current?.c1 ?? from.channel,
    r2: cursor.row,
    c2: cursor.channel,
  });
}

export function setOrder(order: number): void {
  batch(() => {
    cursor.order = Math.min(Math.max(order, 0), readSong().order.length - 1);
    selection.set(null);
  });
}

/** Ctrl+A: the cursor channel first, then the whole pattern. */
export function selectAll(): void {
  const last = rows() - 1;
  const sel = selection();
  const channelOnly =
    sel && sel.c1 === sel.c2 && Math.min(sel.r1, sel.r2) === 0 && Math.max(sel.r1, sel.r2) === last;
  selection.set(
    channelOnly
      ? { r1: 0, c1: 0, r2: last, c2: CHANNEL_COUNT - 1 }
      : { r1: 0, c1: cursor.channel, r2: last, c2: cursor.channel },
  );
}

// --- Entry ---

const advance = () => moveRows(prefs.step);

export function enterNote(semitone: number): void {
  const note = Math.min(Math.max(prefs.octave * 12 + semitone, 0), NOTE_MAX);
  const channel = cursor.channel;
  engine.jam(channel, note, prefs.instrument);
  if (!prefs.record) return;
  edit("Enter note", () => {
    set([...cellPath(cursor.row, channel), "note"], note);
    set([...cellPath(cursor.row, channel), "inst"], prefs.instrument);
  });
  advance();
}

export function releaseNote(): void {
  engine.jamOff(cursor.channel);
}

export function enterControl(note: typeof NOTE_OFF | typeof NOTE_CUT): void {
  if (!prefs.record) return;
  edit(note === NOTE_OFF ? "Note off" : "Note cut", () =>
    set([...cellPath(cursor.row, cursor.channel), "note"], note),
  );
  advance();
}

/** A hex digit typed in the instrument, volume or parameter columns. */
export function enterDigit(digit: number): void {
  if (!prefs.record) return;
  const column = cursor.column;
  const cell = currentCell();
  const path = cellPath(cursor.row, cursor.channel);
  if (column === 1 || column === 2) {
    const value = Math.max(cell.inst, 0);
    const next = column === 1 ? (digit << 4) | (value & 15) : (value & 0xf0) | digit;
    edit("Instrument", () => set([...path, "inst"], next));
    if (column === 1) moveTo(cursor.row, cursor.channel, 2);
    else {
      moveTo(cursor.row, cursor.channel, 1);
      advance();
    }
  } else if (column === 3) {
    edit("Volume", () => set([...path, "vol"], digit));
    advance();
  } else if (column === 5 || column === 6) {
    if (cell.fx === "") return say("Type an effect first: " + EFFECT_CODES.join(" "));
    const next = column === 5 ? (digit << 4) | (cell.param & 15) : (cell.param & 0xf0) | digit;
    edit("Effect parameter", () => set([...path, "param"], next));
    if (column === 5) moveTo(cursor.row, cursor.channel, 6);
    else {
      moveTo(cursor.row, cursor.channel, 5);
      advance();
    }
  }
}

export function enterEffect(code: string): boolean {
  if (!prefs.record || !(EFFECT_CODES as string[]).includes(code)) return false;
  edit("Effect", () => set([...cellPath(cursor.row, cursor.channel), "fx"], code));
  moveTo(cursor.row, cursor.channel, 5);
  return true;
}

/** Delete: the selection, or the field under the cursor. */
export function clearField(): void {
  const sel = selection();
  if (sel) {
    clearSelection();
    return;
  }
  const path = cellPath(cursor.row, cursor.channel);
  const field = COLUMNS[cursor.column]!.field;
  edit("Clear", () => {
    if (field === "note") {
      set([...path, "note"], NOTE_EMPTY);
      set([...path, "inst"], -1);
      set([...path, "vol"], -1);
    } else if (field === "fx" || field === "param") {
      set([...path, "fx"], "");
      set([...path, "param"], 0);
    } else {
      set([...path, field], -1);
    }
  });
  advance();
}

function forSelection(fn: (row: number, channel: number) => void): void {
  const sel = selection();
  if (!sel) {
    fn(cursor.row, cursor.channel);
    return;
  }
  const { top, bottom, left, right } = selectionBounds(sel);
  for (let row = top; row <= bottom; row++) for (let ch = left; ch <= right; ch++) fn(row, ch);
}

export function clearSelection(): void {
  edit("Clear selection", () => forSelection((row, ch) => set(cellPath(row, ch), emptyCell())));
}

/** Shifts the cursor channel (or the selected channels) down from the cursor row. */
export function insertRow(): void {
  shiftRows(1, "Insert row");
}

export function deleteRow(): void {
  shiftRows(-1, "Delete row");
}

function shiftRows(direction: 1 | -1, label: string): void {
  const sel = selection();
  const { left, right } = sel ? selectionBounds(sel) : { left: cursor.channel, right: cursor.channel };
  const top = cursor.row;
  const length = rows();
  const cells = readSong().patterns[patternIndex()]!.rows;
  edit(label, () => {
    for (let ch = left; ch <= right; ch++) {
      const column = cells.map((row) => clone(row[ch]!));
      for (let row = top; row < length; row++) {
        const source = direction === 1 ? row - 1 : row + 1;
        const value = source >= top && source < length ? column[source]! : emptyCell();
        set(cellPath(row, ch), row === top && direction === 1 ? emptyCell() : value);
      }
    }
  });
}

export function transpose(semitones: number): void {
  const isNoise = (ch: number) => CHANNELS[ch]!.kind === "noise";
  edit(
    semitones > 0 ? "Transpose up" : "Transpose down",
    () =>
      forSelection((row, ch) => {
        const cell = currentCell(row, ch);
        if (cell.note < 0 || cell.note > NOTE_MAX) return;
        const next = cell.note + (isNoise(ch) ? Math.sign(semitones) : semitones);
        if (next >= 0 && next <= NOTE_MAX) set([...cellPath(row, ch), "note"], next);
      }),
    `transpose:${semitones}`,
  );
}

// --- Clipboard ---

let clipboard: Cell[][] | null = null;
export const hasClipboard = signal(false);

export function copy(): void {
  const sel = selection() ?? {
    r1: cursor.row,
    r2: cursor.row,
    c1: cursor.channel,
    c2: cursor.channel,
  };
  const { top, bottom, left, right } = selectionBounds(sel);
  const cells = readSong().patterns[patternIndex()]!.rows;
  clipboard = [];
  for (let row = top; row <= bottom; row++) {
    clipboard.push(cells[row]!.slice(left, right + 1).map((cell) => clone(cell)));
  }
  hasClipboard.set(true);
  say(`Copied ${bottom - top + 1} rows × ${right - left + 1} channels`);
}

export function cut(): void {
  copy();
  if (!selection()) {
    selection.set({ r1: cursor.row, r2: cursor.row, c1: cursor.channel, c2: cursor.channel });
  }
  edit("Cut", () => forSelection((row, ch) => set(cellPath(row, ch), emptyCell())));
  selection.set(null);
}

export function paste(): void {
  const data = clipboard;
  if (!data) return say("Nothing to paste");
  const length = rows();
  edit("Paste", () => {
    data.forEach((cells, r) =>
      cells.forEach((cell, c) => {
        const row = cursor.row + r;
        const ch = cursor.channel + c;
        if (row < length && ch < CHANNEL_COUNT) set(cellPath(row, ch), cell);
      }),
    );
  });
  selection.set(null);
}

// --- Order list and patterns ---

export function insertOrder(duplicate: boolean): void {
  const song = readSong();
  const at = cursor.order + 1;
  edit(duplicate ? "Duplicate pattern" : "Insert order", () => {
    let pattern = song.order[cursor.order] ?? 0;
    if (duplicate) {
      set(["patterns", song.patterns.length], clone(song.patterns[pattern]));
      pattern = song.patterns.length - 1;
    }
    set(["order"], [...song.order.slice(0, at), pattern, ...song.order.slice(at)]);
  });
  setOrder(at);
}

export function newPatternOrder(): void {
  const song = readSong();
  const at = cursor.order + 1;
  edit("New pattern", () => {
    set(["patterns", song.patterns.length], emptyPattern(song.patternLength));
    set(["order"], [...song.order.slice(0, at), song.patterns.length - 1, ...song.order.slice(at)]);
  });
  setOrder(at);
}

export function removeOrder(): void {
  const song = readSong();
  if (song.order.length <= 1) return say("A song needs at least one order");
  const at = cursor.order;
  edit("Remove order", () => set(["order"], song.order.filter((_, i) => i !== at)));
  setOrder(Math.min(at, song.order.length - 1));
}

export function moveOrder(delta: number): void {
  const song = readSong();
  const from = cursor.order;
  const to = from + delta;
  if (to < 0 || to >= song.order.length) return;
  const order = [...song.order];
  [order[from], order[to]] = [order[to]!, order[from]!];
  edit("Move order", () => set(["order"], order));
  setOrder(to);
}

/** Changes the pattern played at the cursor order; one past the last creates an empty pattern. */
export function stepOrderPattern(delta: number): void {
  const song = readSong();
  const current = song.order[cursor.order] ?? 0;
  const next = current + delta;
  if (next < 0 || next > song.patterns.length || next > 255) return;
  edit("Change order pattern", () => {
    if (next === song.patterns.length) {
      set(["patterns", next], emptyPattern(song.patternLength));
    }
    set(["order", cursor.order], next);
  });
}

export function changeOctave(delta: number): void {
  prefs.octave = Math.min(Math.max(prefs.octave + delta, 0), 7);
  say(`Octave ${prefs.octave}`);
}

export function changeInstrument(delta: number): void {
  const count = doc.song.instruments.length;
  prefs.instrument = (prefs.instrument + delta + count) % count;
  say(`Instrument ${prefs.instrument.toString(16).toUpperCase().padStart(2, "0")}`);
}
