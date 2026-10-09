// The SFX gallery: original sound effects written the way a Game Boy RPG writes them, as short
// runs of square and noise notes (length in frames, volume, envelope, pitch) with duty cycles and
// hardware pitch sweeps. The maker applies a few friendly modifiers on top of a preset.
import { freqReg, sweepByte } from "../audio/driver.ts";
import { DUTY_NAMES } from "./instruments.ts";
import { noteName, parseNote } from "./music.ts";
import type { Sfx, SfxNote, SfxVoice } from "./types.ts";

export function sq(
  frames: number,
  volume: number,
  env: number,
  note: string | number,
  duty = 2,
  sweep = 0,
): SfxNote {
  const pitch = typeof note === "number" ? note : parseNote(note);
  return { frames, volume, env, pitch, duty, sweep, noise: 0 };
}

export const rest = (frames: number): SfxNote => sq(frames, 0, 0, 60);

/** A noise note: NR43 from clock shift `s`, divisor `r`, and 7-bit (metallic) mode `w`. */
export function nz(
  frames: number,
  volume: number,
  env: number,
  s: number,
  r: number,
  w = 0,
): SfxNote {
  return { frames, volume, env, pitch: 0, duty: 0, sweep: 0, noise: (s << 4) | (w << 3) | r };
}

export const p1 = (...notes: SfxNote[]): SfxVoice => ({ channel: 0, notes });
export const p2 = (...notes: SfxNote[]): SfxVoice => ({ channel: 1, notes });
export const ns = (...notes: SfxNote[]): SfxVoice => ({ channel: 3, notes });

export const SFX: Sfx[] = [
  {
    id: "select",
    name: "Select",
    blurb: "Two quick rising pings for a confirmed menu choice.",
    voices: [p1(sq(3, 12, 0, "E6", 2), sq(6, 12, 5, "A6", 2))],
  },
  {
    id: "cursor",
    name: "Cursor",
    blurb: "A tiny tick for moving through a menu.",
    voices: [p1(sq(4, 9, 7, "B6", 1))],
  },
  {
    id: "back",
    name: "Back",
    blurb: "The select ping, turned around: falling, softer.",
    voices: [p1(sq(3, 10, 0, "A5", 2), sq(6, 9, 4, "E5", 2))],
  },
  {
    id: "text",
    name: "Text blip",
    blurb: "One letter of dialogue appearing.",
    voices: [p2(sq(2, 7, 0, "A5", 1), rest(1))],
  },
  {
    id: "error",
    name: "Error",
    blurb: "A low 75% buzz, twice: not allowed.",
    voices: [p1(sq(6, 12, 0, "C#3", 3), rest(3), sq(10, 12, 3, "C#3", 3))],
  },
  {
    id: "jump",
    name: "Jump",
    blurb: "A square note with the hardware sweep pushing it up.",
    voices: [p1(sq(16, 12, 2, "C5", 2, 3))],
  },
  {
    id: "hit",
    name: "Hit",
    blurb: "A noise crack over a 75% square sweeping down.",
    voices: [p1(sq(14, 15, 3, "G4", 3, -6)), ns(nz(2, 15, 1, 2, 1), nz(10, 12, 2, 4, 5))],
  },
  {
    id: "bump",
    name: "Bump",
    blurb: "Walking into a wall: a dark noise thud.",
    voices: [p1(sq(5, 9, 3, "C2", 3)), ns(nz(2, 12, 1, 6, 5), nz(5, 8, 2, 7, 7))],
  },
  {
    id: "door",
    name: "Door",
    blurb: "A slide of noise that gets darker as the door closes.",
    voices: [ns(nz(3, 10, 0, 3, 3), nz(4, 11, 0, 4, 3), nz(5, 10, 0, 5, 3), nz(12, 9, 3, 6, 4))],
  },
  {
    id: "pickup",
    name: "Pickup",
    blurb: "Three rising notes with a ringing tail: you found something small.",
    voices: [p1(sq(3, 11, 0, "D6", 1), sq(3, 11, 0, "A6", 1), sq(18, 11, 4, "D7", 1))],
  },
  {
    id: "heal",
    name: "Heal",
    blurb: "A sparkling arpeggio on both pulses, the second a beat behind.",
    voices: [
      p1(
        ...["C6", "E6", "G6", "C7", "E7", "G7"].map((n, i) => sq(3, 12 - i, 0, n, 0)),
        sq(12, 6, 3, "C7", 0),
      ),
      p2(
        rest(2),
        ...["C6", "E6", "G6", "C7", "E7", "G7"].map((n, i) => sq(3, 7 - i, 0, n, 1)),
        sq(10, 3, 3, "C7", 1),
      ),
    ],
  },
  {
    id: "save",
    name: "Save",
    blurb: "A calm three-note chime: your progress is safe.",
    voices: [
      p1(sq(9, 11, 3, "G5", 1), sq(9, 11, 3, "D6", 1), sq(30, 11, 2, "B6", 1)),
      p2(rest(9), sq(9, 6, 3, "B5", 0), sq(30, 6, 2, "G6", 0)),
    ],
  },
  {
    id: "item",
    name: "Item get",
    blurb: "A short two-voice jingle for finding something important.",
    voices: [
      p1(
        sq(6, 12, 0, "C6", 2),
        sq(6, 12, 0, "G5", 2),
        sq(6, 12, 0, "C6", 2),
        sq(6, 12, 0, "E6", 2),
        sq(36, 12, 2, "G6", 2),
      ),
      p2(
        sq(6, 8, 0, "E5", 1),
        sq(6, 8, 0, "E5", 1),
        sq(6, 8, 0, "G5", 1),
        sq(6, 8, 0, "C6", 1),
        sq(36, 8, 2, "E6", 1),
      ),
    ],
  },
  {
    id: "levelup",
    name: "Level up",
    blurb: "A triumphant fanfare with a crash on the last chord.",
    voices: [
      p1(
        sq(5, 12, 0, "C5", 2),
        sq(5, 12, 0, "C5", 2),
        sq(5, 12, 0, "C5", 2),
        sq(12, 12, 0, "G5", 2),
        sq(6, 12, 0, "F5", 2),
        sq(6, 12, 0, "G5", 2),
        sq(40, 13, 2, "C6", 2),
      ),
      p2(
        sq(5, 8, 0, "E4", 1),
        sq(5, 8, 0, "E4", 1),
        sq(5, 8, 0, "E4", 1),
        sq(12, 8, 0, "D5", 1),
        sq(6, 8, 0, "A4", 1),
        sq(6, 8, 0, "B4", 1),
        sq(40, 9, 2, "E5", 1),
      ),
      ns(rest(39), nz(30, 11, 4, 1, 3)),
    ],
  },
  {
    id: "warp",
    name: "Warp",
    blurb: "A long falling sweep through a wash of noise.",
    voices: [p1(sq(42, 12, 1, "C7", 2, -2)), ns(nz(42, 7, 1, 1, 4))],
  },
];

export const sfxById = (id: string): Sfx | undefined => SFX.find((s) => s.id === id);

// --- The maker ---

export interface SfxMods {
  /** Semitones, -12…12 (pulse notes). */
  pitch: number;
  /** Length factor, 0.5…2. */
  length: number;
  /** Pulse 1 sweep override, -7…7; 0 keeps the preset's own. */
  sweep: number;
  /** Duty override 0–3, or -1 to keep the preset's. */
  duty: number;
  /** Noise brightness, -3…3. */
  tone: number;
  /** Volume, 0.25…1. */
  volume: number;
}

export const NO_MODS: SfxMods = { pitch: 0, length: 1, sweep: 0, duty: -1, tone: 0, volume: 1 };

export function applyMods(sfx: Sfx, mods: SfxMods): Sfx {
  return {
    ...sfx,
    voices: sfx.voices.map((voice) => ({
      ...voice,
      notes: voice.notes.map((n) => {
        const frames = Math.max(1, Math.round(n.frames * mods.length));
        const volume = n.volume === 0 ? 0 : Math.max(1, Math.round(n.volume * mods.volume));
        if (voice.channel === 3) {
          const s = Math.min(13, Math.max(0, (n.noise >> 4) - mods.tone));
          return { ...n, frames, volume, noise: (s << 4) | (n.noise & 0x0f) };
        }
        return {
          ...n,
          frames,
          volume,
          pitch: Math.min(120, Math.max(36, n.pitch + mods.pitch)),
          duty: mods.duty >= 0 ? mods.duty : n.duty,
          sweep: voice.channel === 0 && mods.sweep !== 0 ? mods.sweep : n.sweep,
        };
      }),
    })),
  };
}

const hex = (n: number, digits: number) => `$${n.toString(16).toUpperCase().padStart(digits, "0")}`;

/** Crystal's fade argument: 1–7 fades, 8+n swells, 0 holds. */
const fadeArg = (env: number) => (env > 0 ? 8 - env : env < 0 ? 8 + (8 + env) : 0);

/**
 * The SFX as Crystal-style driver macros, the way the original games' sound engine reads them:
 * `square_note frames, volume, fade, frequency` and `noise_note frames, volume, fade, polynomial`.
 */
export function listing(sfx: Sfx): string {
  const lines: string[] = [];
  for (const voice of sfx.voices) {
    lines.push(`; ${voice.channel === 3 ? "noise" : `pulse ${voice.channel + 1}`}`);
    let duty = -1;
    let sweep = 0;
    for (const n of voice.notes) {
      if (voice.channel === 3) {
        lines.push(`  noise_note ${n.frames}, ${n.volume}, ${fadeArg(n.env)}, ${hex(n.noise, 2)}`);
        continue;
      }
      if (n.volume === 0) {
        lines.push(`  square_note ${n.frames}, 0, 0, 0  ; rest`);
        continue;
      }
      if (n.duty !== duty) lines.push(`  duty_cycle ${(duty = n.duty)}  ; ${DUTY_NAMES[n.duty]}`);
      if (voice.channel === 0 && n.sweep !== sweep) {
        sweep = n.sweep;
        const byte = sweepByte(n.sweep);
        lines.push(`  pitch_sweep ${byte >> 4}, ${byte & 0x08 ? "-" : ""}${byte & 7}`);
      }
      lines.push(
        `  square_note ${n.frames}, ${n.volume}, ${fadeArg(n.env)}, ${hex(freqReg(n.pitch, false), 3)}  ; ${noteName(n.pitch)}`,
      );
    }
    lines.push("  sound_ret");
  }
  return lines.join("\n");
}
