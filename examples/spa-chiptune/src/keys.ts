// Keyboard-first control: the piano layout on the computer keyboard and the tracker shortcuts.
// One document-level handler routes keys to the current view unless a form control has focus.
import * as engine from "./audio/engine.ts";
import * as ed from "./editor.ts";
import { playing } from "./frame.ts";
import { NOTE_CUT, NOTE_OFF } from "./model/types.ts";
import { cursor, doc, prefs, redo, undo, view } from "./state.ts";
import { exportWav } from "./files.ts";

/** Physical key → semitone from the current octave (two rows, like a piano). */
export const PIANO: Record<string, number> = {
  KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9,
  KeyJ: 10, KeyM: 11, Comma: 12, KeyL: 13, Period: 14, Semicolon: 15, Slash: 16,
  KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19,
  Digit6: 20, KeyY: 21, Digit7: 22, KeyU: 23, KeyI: 24, Digit9: 25, KeyO: 26, Digit0: 27,
  KeyP: 28,
};

/** Shortcut reference, shown in the settings view. */
export const SHORTCUTS: [string, string][] = [
  ["Z S X D C … / Q 2 W 3 E …", "Play and enter notes (two octaves)"],
  ["1 / -", "Note off (release) / note cut"],
  ["0-9 A-F", "Instrument, volume and parameter digits"],
  ["0 1 2 3 4 A B D F S V", "Effect command (effect column)"],
  ["[ / ]", "Octave down / up"],
  ["{ / }", "Previous / next instrument"],
  ["Arrows, Tab, PgUp/PgDn, Home/End", "Move the cursor"],
  ["Shift + arrows, Ctrl/Cmd+A", "Select (again for every channel)"],
  ["Ctrl/Cmd + C X V", "Copy, cut, paste"],
  ["Delete / Backspace / Insert", "Clear / delete row / insert row"],
  ["Alt + Up/Down (Shift: octave)", "Transpose note or selection"],
  ["Ctrl/Cmd + Z, Shift+Z or Y", "Undo, redo"],
  ["Space / Shift+Space / Enter", "Play song / pattern / from the cursor row; stop"],
  ["` (backquote)", "Toggle record mode"],
  ["F1 … F4", "Tracker, instruments, songs, settings"],
  ["Ctrl/Cmd + E", "Export WAV"],
];

function isFormControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (target as HTMLInputElement).type;
    return type !== "range" && type !== "checkbox" && type !== "radio" && type !== "button";
  }
  return false;
}

const held = new Set<string>();

export function togglePlay(mode: "song" | "pattern" | "row"): void {
  if (playing()) {
    engine.stop();
    return;
  }
  void engine.play(mode === "pattern" ? "pattern" : "song", cursor.order, mode === "row" ? cursor.row : 0);
}

function global(event: KeyboardEvent, mod: boolean): boolean {
  const key = event.key.toLowerCase();
  if (mod && key === "z") {
    if (event.shiftKey) redo();
    else undo();
    return true;
  }
  if (mod && key === "y") {
    redo();
    return true;
  }
  if (mod && key === "e") {
    void exportWav();
    return true;
  }
  const views = { F1: "tracker", F2: "instruments", F3: "songs", F4: "settings" } as const;
  const next = views[event.code as keyof typeof views];
  if (next) {
    view.set(next);
    return true;
  }
  return false;
}

/** Keys shared by the tracker and instrument views: octave, instrument, jam notes. */
function common(event: KeyboardEvent, jamOnly: boolean): boolean {
  if (event.code === "BracketLeft") {
    if (event.shiftKey) ed.changeInstrument(-1);
    else ed.changeOctave(-1);
    return true;
  }
  if (event.code === "BracketRight") {
    if (event.shiftKey) ed.changeInstrument(1);
    else ed.changeOctave(1);
    return true;
  }
  const semitone = PIANO[event.code];
  if (jamOnly && semitone !== undefined && !event.altKey) {
    if (!event.repeat) {
      held.add(event.code);
      engine.jam(
        cursor.channel,
        Math.min(95, prefs.octave * 12 + semitone),
        prefs.instrument,
      );
    }
    return true;
  }
  return false;
}

function tracker(event: KeyboardEvent, mod: boolean): boolean {
  const { code, shiftKey: shift, altKey: alt } = event;
  if (mod) {
    switch (event.key.toLowerCase()) {
      case "c":
        ed.copy();
        return true;
      case "x":
        ed.cut();
        return true;
      case "v":
        ed.paste();
        return true;
      case "a":
        ed.selectAll();
        return true;
    }
    return false;
  }
  switch (code) {
    case "ArrowUp":
    case "ArrowDown": {
      const dir = code === "ArrowUp" ? -1 : 1;
      if (alt) ed.transpose(dir * -1 * (shift ? 12 : 1));
      else ed.moveRows(dir, shift);
      return true;
    }
    case "ArrowLeft":
    case "ArrowRight": {
      const dir = code === "ArrowLeft" ? -1 : 1;
      if (shift) ed.moveChannel(dir, true);
      else ed.moveColumns(dir);
      return true;
    }
    case "Tab":
      ed.moveChannel(shift ? -1 : 1);
      return true;
    case "PageUp":
    case "PageDown":
      ed.moveRows(code === "PageUp" ? -16 : 16, shift);
      return true;
    case "Home":
      ed.moveTo(0);
      return true;
    case "End":
      ed.moveTo(doc.song.patternLength - 1);
      return true;
    case "Delete":
      ed.clearField();
      return true;
    case "Backspace":
      ed.deleteRow();
      return true;
    case "Insert":
      ed.insertRow();
      return true;
    case "Space":
      togglePlay(shift ? "pattern" : "song");
      return true;
    case "Enter":
      togglePlay("row");
      return true;
    case "Backquote":
      prefs.record = !prefs.record;
      return true;
    case "Escape":
      ed.selection.set(null);
      return true;
  }
  if (event.repeat && PIANO[code] !== undefined && cursor.column === 0) return true;
  if (common(event, false)) return true;
  if (cursor.column === 0) {
    if (code === "Digit1") {
      ed.enterControl(NOTE_OFF);
      return true;
    }
    if (code === "Minus") {
      ed.enterControl(NOTE_CUT);
      return true;
    }
    const semitone = PIANO[code];
    if (semitone !== undefined && !alt) {
      held.add(code);
      ed.enterNote(semitone);
      return true;
    }
    return false;
  }
  if (cursor.column === 4) return ed.enterEffect(event.key.toUpperCase());
  const digit = /^[0-9a-f]$/i.test(event.key) ? parseInt(event.key, 16) : -1;
  if (digit >= 0) {
    ed.enterDigit(digit);
    return true;
  }
  return false;
}

export function onKeyDown(event: KeyboardEvent): void {
  const mod = event.metaKey || event.ctrlKey;
  const target = event.target;
  if (isFormControl(target)) return;
  // A focused button keeps Space and Enter (activation); the tracker gets every other key.
  const onButton = target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement;
  if (onButton && (event.code === "Space" || event.code === "Enter")) return;
  // A focused slider keeps its navigation keys.
  const onSlider = target instanceof HTMLInputElement && target.type === "range";
  if (onSlider && /^(Arrow|Page|Home|End)/.test(event.code)) return;
  let handled = global(event, mod);
  if (!handled) {
    const current = view();
    if (current === "tracker") handled = tracker(event, mod);
    else if (current === "instruments" && !mod) handled = common(event, true);
  }
  if (handled) event.preventDefault();
}

export function onKeyUp(event: KeyboardEvent): void {
  if (held.delete(event.code)) ed.releaseNote();
}
