// Global keyboard shortcuts. Typing in a field never triggers them, and Space never steals a
// focused button's own Space.
import { signal } from "lumen";
import { stop, nowPlaying, looping, setLooping } from "./audio/player.ts";
import { editor, redo, say, togglePlay, undo } from "./state.ts";
import type { ChannelIndex } from "./model/types.ts";

export const shortcutsOpen = signal(false);

/** What Space does on the current page (the studio plays its song; the SFX page plays a sound). */
let spaceAction: (() => void) | undefined;
export function onSpace(fn: (() => void) | undefined): void {
  spaceAction = fn;
}

/** Keys the grid handles itself while focused (arrows, Enter, Delete…). */
let gridFocused = false;
export function setGridFocused(on: boolean): void {
  gridFocused = on;
}

function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function onKeyDown(event: KeyboardEvent): void {
  if (event.defaultPrevented || typing(event.target)) return;
  const mod = event.metaKey || event.ctrlKey;
  const key = event.key;
  if (mod && key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }
  if (mod && key.toLowerCase() === "y") {
    event.preventDefault();
    redo();
    return;
  }
  if (mod || event.altKey) return;
  if (key === " ") {
    const target = event.target as HTMLElement | null;
    if (target && !gridFocused && ["BUTTON", "A", "SUMMARY"].includes(target.tagName)) return;
    event.preventDefault();
    if (nowPlaying() && nowPlaying() !== "editor") stop();
    else (spaceAction ?? togglePlay)();
    return;
  }
  if (key === "?") {
    shortcutsOpen.set(!shortcutsOpen());
    return;
  }
  if (key === "Escape" && nowPlaying()) {
    stop();
    return;
  }
  if (key.toLowerCase() === "l") {
    setLooping(!looping());
    say(looping() ? "Loop on" : "Loop off: the song plays once");
    return;
  }
  if (!gridFocused && ["1", "2", "3", "4"].includes(key)) {
    editor.channel = (Number(key) - 1) as ChannelIndex;
  }
}
