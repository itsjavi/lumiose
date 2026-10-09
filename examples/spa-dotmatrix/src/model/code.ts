// Reading driver code back: the format the SFX and Creatures code view shows (see `listing` in
// sfx.ts and docs/composing.md) parses into an SFX the maker can play, with line-numbered errors.
//
//   ; base voice "Yip", pitch $0018, length $00E6   optional: a creature's header (informational)
//   ; pulse 1                                       a channel section: pulse 1, pulse 2 or noise
//     duty_cycle 2                                  0–3
//     duty_cycle_pattern 3, 3, 0, 0                 four duties, one per frame
//     pitch_sweep 2, -4                             pulse 1 only: pace, ±shift
//     square_note 4, 12, 1, $7C1  ; slides -9/frame  frames, volume, fade, frequency register
//     square_note 3, 0, 0, 0                        volume 0: a rest
//     noise_note 2, 10, 1, $23                      frames, volume, fade, noise setting
//     sound_ret                                     ends the section
//
// Numbers are decimal or `$` hex. Everything after `;` is a comment, except the slide annotation
// (`slides ±n/frame`) on a square note, which the code view writes for Dotmatrix's slides.
import { sweepByte } from "../audio/driver.ts";
import { regPitch } from "./creatures.ts";
import type { Sfx, SfxNote, SfxVoice } from "./types.ts";

export interface CodeError {
  /** 1-based line number. */
  line: number;
  message: string;
}

export type CodeResult = { sfx: Sfx; frames: number } | { errors: CodeError[] };

const SECTIONS: Record<string, SfxVoice["channel"]> = { "pulse 1": 0, "pulse 2": 1, noise: 3 };

/** The friendly sweep amount whose register byte is `byte` (several amounts share a byte). */
const SWEEPS = new Map<number, number>();
for (let m = 7; m >= -7; m--) if (m !== 0) SWEEPS.set(sweepByte(m), m);
SWEEPS.set(0, 0);

/** Crystal's fade argument back to Dotmatrix's signed envelope (see `fadeArg` in sfx.ts). */
const fadeEnv = (fade: number) => (fade === 0 || fade === 8 ? 0 : fade < 8 ? 8 - fade : fade - 16);

function parseNumber(text: string): number | undefined {
  const t = text.trim();
  if (/^\$[0-9a-f]+$/i.test(t)) return parseInt(t.slice(1), 16);
  if (/^-?\d+$/.test(t)) return Number(t);
  return undefined;
}

export function parseCode(text: string, name = "Pasted sound"): CodeResult {
  const errors: CodeError[] = [];
  const voices: SfxVoice[] = [];
  let voice: SfxVoice | undefined;
  let closed = false;
  let duty = 2;
  let pattern: number | undefined;
  let sweep = 0;

  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = i + 1;
    const fail = (message: string) => errors.push({ line, message });
    const semi = raw.indexOf(";");
    const code = (semi < 0 ? raw : raw.slice(0, semi)).trim();
    const comment = semi < 0 ? "" : raw.slice(semi + 1).trim();

    if (!code) {
      const section = /^(pulse 1|pulse 2|noise|wave)\b/i.exec(comment);
      if (!section) return;
      const key = section[1]!.toLowerCase();
      if (key === "wave")
        return fail("Sound effects use pulse 1, pulse 2 and noise; the wave channel is for songs");
      if (voices.some((v) => v.channel === SECTIONS[key])) return fail(`“${key}” appears twice`);
      voice = { channel: SECTIONS[key]!, notes: [] };
      voices.push(voice);
      closed = false;
      duty = 2;
      pattern = undefined;
      sweep = 0;
      return;
    }

    const [command, ...rest] = code.split(/\s+/);
    const args = rest
      .join(" ")
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a !== "");
    const numbers = args.map(parseNumber);
    const bad = args.findIndex((_, k) => numbers[k] === undefined);
    if (bad >= 0) return fail(`“${args[bad]}” is not a number (write 12 or $0C)`);
    const n = numbers as number[];
    const need = (count: number) => {
      if (n.length === count) return true;
      fail(`${command} takes ${count} number${count === 1 ? "" : "s"}, found ${n.length}`);
      return false;
    };
    const range = (value: number, lo: number, hi: number, what: string) => {
      if (value >= lo && value <= hi) return true;
      fail(`${what} must be ${lo}–${hi}, found ${value}`);
      return false;
    };

    if (!voice) return fail("Start with a channel line: “; pulse 1”, “; pulse 2” or “; noise”");
    if (closed) return fail("Code after sound_ret: start a new channel section first");
    const pulse = voice.channel !== 3;

    switch (command) {
      case "sound_ret":
        if (n.length) return fail("sound_ret takes no numbers");
        closed = true;
        return;
      case "duty_cycle":
        if (!pulse) return fail("duty_cycle only works on the pulse channels");
        if (need(1) && range(n[0]!, 0, 3, "The duty")) {
          duty = n[0]!;
          pattern = undefined;
        }
        return;
      case "duty_cycle_pattern":
        if (!pulse) return fail("duty_cycle_pattern only works on the pulse channels");
        if (need(4) && n.every((d) => range(d, 0, 3, "Each duty"))) {
          pattern = (n[0]! << 6) | (n[1]! << 4) | (n[2]! << 2) | n[3]!;
        }
        return;
      case "pitch_sweep": {
        if (voice.channel !== 0) return fail("pitch_sweep only works on pulse 1");
        const shiftText = args[1] ?? "";
        if (
          !need(2) ||
          !range(n[0]!, 0, 7, "The pace") ||
          !range(Math.abs(n[1]!), 0, 7, "The shift")
        )
          return;
        const byte =
          n[0] === 0 || n[1] === 0
            ? 0
            : (n[0]! << 4) | (shiftText.startsWith("-") ? 0x08 : 0) | Math.abs(n[1]!);
        const amount = SWEEPS.get(byte);
        if (amount === undefined) {
          const options = [
            ...new Set(
              [...SWEEPS.keys()]
                .filter((b) => b)
                .map((b) => `${b >> 4}, ${b & 8 ? "-" : ""}${b & 7}`),
            ),
          ];
          return fail(`Dotmatrix plays these sweeps: ${options.join(" · ")}`);
        }
        sweep = amount;
        return;
      }
      case "square_note": {
        if (!pulse) return fail("square_note is for the pulse channels; use noise_note here");
        if (
          !need(4) ||
          !range(n[0]!, 1, 255, "Frames") ||
          !range(n[1]!, 0, 15, "The volume") ||
          !range(n[2]!, 0, 15, "The fade")
        )
          return;
        if (n[1] === 0) {
          voice.notes.push({
            frames: n[0]!,
            volume: 0,
            env: 0,
            pitch: 60,
            duty,
            sweep: 0,
            noise: 0,
          });
          return;
        }
        if (!range(n[3]!, 0, 2047, "The frequency register")) return;
        const slide = /slides ([+-]?\d+)\/frame/.exec(comment);
        const note: SfxNote = {
          frames: n[0]!,
          volume: n[1]!,
          env: fadeEnv(n[2]!),
          pitch: regPitch(n[3]!),
          duty,
          sweep: voice.channel === 0 ? sweep : 0,
          noise: 0,
        };
        if (pattern !== undefined) note.pattern = pattern;
        if (slide && Number(slide[1]) !== 0) note.slide = Number(slide[1]);
        voice.notes.push(note);
        return;
      }
      case "noise_note":
        if (pulse) return fail("noise_note is for the noise channel; use square_note here");
        if (
          !need(4) ||
          !range(n[0]!, 1, 255, "Frames") ||
          !range(n[1]!, 0, 15, "The volume") ||
          !range(n[2]!, 0, 15, "The fade")
        )
          return;
        if (!range(n[3]!, 0, 255, "The noise setting")) return;
        voice.notes.push(
          n[1] === 0
            ? { frames: n[0]!, volume: 0, env: 0, pitch: 60, duty: 0, sweep: 0, noise: 0 }
            : {
                frames: n[0]!,
                volume: n[1]!,
                env: fadeEnv(n[2]!),
                pitch: 0,
                duty: 0,
                sweep: 0,
                noise: n[3]!,
              },
        );
        return;
      default:
        return fail(`Unknown command “${command}”`);
    }
  });

  if (errors.length === 0) {
    const playable = voices.filter((v) => v.notes.length > 0);
    if (playable.length === 0)
      errors.push({ line: lines.length, message: "No notes yet: add a square_note or noise_note" });
    else {
      const frames = Math.max(
        ...playable.map((v) => v.notes.reduce((sum, x) => sum + x.frames, 0)),
      );
      if (frames > 600)
        errors.push({
          line: lines.length,
          message: `The sound is ${frames} frames long; keep it under 600 (10 s)`,
        });
      else {
        return {
          sfx: { id: "pasted", name, blurb: "Your own sound, from driver code.", voices: playable },
          frames,
        };
      }
    }
  }
  return { errors };
}
