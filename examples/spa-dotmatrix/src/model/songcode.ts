// Songs as driver code: Crystal-style music macros, one section per channel, that the Studio's
// Code view shows and reads back. Exporting and parsing a song gives the identical song.
//
//   song_title "Maple Hollow"               the header: title, author, tempo (BPM), bars, key/scale
//   song_author "Dotmatrix"
//   tempo 104
//   bars 16
//   key F, major
//   ; pulse 1                               a channel: pulse 1, pulse 2, wave or noise
//     instrument reed                       the preset it starts from
//     note_type 1, 11, 7                    step unit, volume, fade (as in square_note)
//     duty_cycle 1                          the instrument, line by line (see docs/composing.md)
//     vibrato 18, 2, 4                      delay (frames), depth, rate
//   .mainloop:                              where the loop starts (a bar line)
//     octave 5
//     note C_, 6                            note name and length in steps
//     rest 2
//     sound_loop 0, .mainloop               loop forever
//
// Noise channels play `drum_note index, length` from the drum kit.
import { DRUMS, instrument } from "./instruments.ts";
import { KEYS, SCALES } from "./music.ts";
import { tidy } from "./song.ts";
import {
  CHANNELS,
  MAX_BARS,
  NOTE_OVERRIDES,
  STEPS_PER_BAR,
  type ArpId,
  type ChannelIndex,
  type Instrument,
  type Note,
  type Pan,
  type ScaleId,
  type Song,
  type Track,
  type WaveShape,
} from "./types.ts";
import type { CodeError } from "./code.ts";

const NOTE_NAMES = [
  "C_",
  "C#",
  "D_",
  "D#",
  "E_",
  "F_",
  "F#",
  "G_",
  "G#",
  "A_",
  "A#",
  "B_",
] as const;
const SECTION_NAMES = ["pulse 1", "pulse 2", "wave", "noise"] as const;
const GATES = ["legato", "normal", "short"] as const;
const PANS: Record<Pan, string> = { L: "left", C: "center", R: "right" };
const ARP_IDS: ArpId[] = ["off", "major", "minor", "fifth", "octave"];
const SHAPES: WaveShape[] = ["soft", "triangle", "saw", "square", "organ", "hollow"];

/** Crystal's fade argument: 1–7 fades out (1 fastest), 9–15 fades in, 0 holds. */
const fadeArg = (env: number) => (env > 0 ? 8 - env : env < 0 ? 16 + env : 0);
const fadeEnv = (fade: number) => (fade === 0 || fade === 8 ? 0 : fade < 8 ? 8 - fade : fade - 16);

function overrides(n: Note): string {
  const parts = NOTE_OVERRIDES.filter((k) => n[k] !== undefined).map((k) => `${k}${n[k]}`);
  return parts.length ? `  ; own ${parts.join(" ")}` : "";
}

/** The song as music macros. Sound sheets use the SFX format instead (see code.ts). */
export function exportSong(song: Song): string {
  const total = song.bars * STEPS_PER_BAR;
  const loopStep = Math.min(song.loop, song.bars - 1) * STEPS_PER_BAR;
  const out = [
    "; Dotmatrix song: music macros, one section per channel",
    `song_title "${song.title.replace(/"/g, "'")}"`,
    `song_author "${song.author.replace(/"/g, "'")}"`,
    `tempo ${song.bpm}  ; quarter notes per minute`,
    `bars ${song.bars}`,
    `key ${KEYS[song.key]}, ${song.scale}`,
  ];
  song.tracks.forEach((track, c) => {
    const ch = c as ChannelIndex;
    const kind = CHANNELS[ch].kind;
    const i = track.inst;
    out.push(`; ${SECTION_NAMES[ch]}`);
    out.push(`  instrument ${i.preset || "custom"}`);
    out.push(`  note_type 1, ${i.volume}, ${fadeArg(i.env)}`);
    if (kind === "pulse") out.push(`  duty_cycle ${i.duty}`);
    if (kind !== "noise") {
      out.push(`  vibrato ${i.vibrato.delay}, ${i.vibrato.depth}, ${i.vibrato.rate}`);
      out.push(`  pitch_glide ${i.glide}`, `  arpeggio ${i.arp}`);
      if (kind === "pulse") out.push(`  shimmer ${i.shimmer ? "on" : "off"}`);
      out.push(`  note_length ${GATES[i.gate]}`);
    }
    if (kind === "wave") out.push(`  wave_shape ${i.shape}`);
    if (kind === "noise") out.push(`  drum_tone ${i.tone}`);
    out.push(`  stereo_panning ${PANS[track.pan]}`);
    if (track.mute) out.push("  mute");
    if (track.solo) out.push("  solo");

    let at = 0;
    let octave: number | undefined;
    let labelled = false;
    const label = () => {
      if (!labelled && at === loopStep) {
        out.push(".mainloop:");
        labelled = true;
      }
    };
    const restTo = (target: number) => {
      while (at < target) {
        label();
        const stop = at < loopStep && target > loopStep ? loopStep : target;
        out.push(`  rest ${stop - at}`);
        at = stop;
      }
    };
    for (const note of tidy(track.notes, total)) {
      restTo(note.s);
      label();
      if (kind === "noise") {
        out.push(
          `  drum_note ${note.p}, ${note.l}  ; ${DRUMS[note.p]?.name ?? "drum"}${overrides(note).replace("  ;", ",")}`,
        );
      } else {
        const o = Math.floor(note.p / 12) - 1;
        if (o !== octave) out.push(`  octave ${(octave = o)}`);
        out.push(`  note ${NOTE_NAMES[note.p % 12]}, ${note.l}${overrides(note)}`);
      }
      at = note.s + note.l;
    }
    restTo(total);
    out.push(labelled ? "  sound_loop 0, .mainloop" : "  sound_ret");
  });
  return out.join("\n");
}

export type SongCodeResult = { song: Song } | { errors: CodeError[] };

function parseNumber(text: string): number | undefined {
  const t = text.trim();
  if (/^\$[0-9a-f]+$/i.test(t)) return parseInt(t.slice(1), 16);
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return undefined;
}

/** Reads music macros back into a song, or lists the errors by line. */
export function parseSong(text: string): SongCodeResult {
  const errors: CodeError[] = [];
  let title = "Untitled";
  let author = "";
  let bpm = 120;
  let bars = 4;
  let key = 0;
  let scale: ScaleId = "major";
  const tracks: (Track | undefined)[] = [undefined, undefined, undefined, undefined];
  const loops: { line: number; step: number }[] = [];
  let ch: ChannelIndex | undefined;
  let at = 0;
  let unit = 1;
  let octave = 4;
  let ended = false;
  const placed: { line: number; ch: ChannelIndex; note: Note }[] = [];

  const lines = text.split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = index + 1;
    const fail = (message: string) => errors.push({ line, message });
    const semi = raw.indexOf(";");
    const code = (semi < 0 ? raw : raw.slice(0, semi)).trim();
    const comment = semi < 0 ? "" : raw.slice(semi + 1).trim();

    if (!code) {
      const section = /^(pulse 1|pulse 2|wave|noise)\s*$/i.exec(comment);
      if (!section) return;
      const c = SECTION_NAMES.indexOf(
        section[1]!.toLowerCase() as (typeof SECTION_NAMES)[number],
      ) as ChannelIndex;
      if (tracks[c]) return fail(`“${SECTION_NAMES[c]}” appears twice`);
      ch = c;
      tracks[c] = {
        inst: instrument(CHANNELS[c].kind, ""),
        notes: [],
        mute: false,
        solo: false,
        pan: "C",
      };
      at = 0;
      unit = 1;
      octave = 4;
      ended = false;
      return;
    }
    if (code === ".mainloop:") {
      if (ch === undefined) return fail("A loop label belongs inside a channel section");
      if (at % STEPS_PER_BAR !== 0)
        return fail(`The loop must start on a bar line (this is step ${at})`);
      loops.push({ line, step: at });
      return;
    }

    const space = code.search(/\s/);
    const command = space < 0 ? code : code.slice(0, space);
    const rest = space < 0 ? "" : code.slice(space + 1).trim();
    const args = rest === "" ? [] : rest.split(",").map((a) => a.trim());
    const nums = () => {
      const n = args.map(parseNumber);
      const bad = n.findIndex((x) => x === undefined);
      if (bad >= 0) {
        fail(`“${args[bad]}” is not a number`);
        return undefined;
      }
      return n as number[];
    };
    const need = (count: number): number[] | undefined => {
      const n = nums();
      if (!n) return undefined;
      if (n.length !== count) {
        fail(`${command} takes ${count} number${count === 1 ? "" : "s"}, found ${n.length}`);
        return undefined;
      }
      return n;
    };
    const range = (value: number, lo: number, hi: number, what: string) => {
      if (Number.isInteger(value) && value >= lo && value <= hi) return true;
      fail(`${what} must be a whole number ${lo}–${hi}, found ${value}`);
      return false;
    };
    const word = (options: readonly string[], what: string): string | undefined => {
      const w = rest.toLowerCase();
      if (options.includes(w)) return w;
      fail(`${what} is one of ${options.join(", ")}`);
      return undefined;
    };

    // --- Header ---
    if (command === "song_title" || command === "song_author") {
      const m = /^"(.*)"$/.exec(rest);
      if (!m) return fail(`${command} takes a text in quotes`);
      if (command === "song_title") title = m[1]!.slice(0, 60);
      else author = m[1]!.slice(0, 60);
      return;
    }
    if (command === "tempo") {
      const n = need(1);
      if (n && range(n[0]!, 50, 240, "The tempo")) bpm = n[0]!;
      return;
    }
    if (command === "bars") {
      const n = need(1);
      if (n && range(n[0]!, 1, MAX_BARS, "Bars")) bars = n[0]!;
      return;
    }
    if (command === "key") {
      const [name, scaleName] = args;
      const k = KEYS.findIndex((x) => x.toLowerCase() === (name ?? "").toLowerCase());
      if (k < 0) return fail(`The key is a note name: ${KEYS.join(", ")}`);
      if (!scaleName || !(scaleName in SCALES))
        return fail(`The scale is one of ${Object.keys(SCALES).join(", ")}`);
      key = k;
      scale = scaleName as ScaleId;
      return;
    }

    if (ch === undefined)
      return fail("Start a channel first: “; pulse 1”, “; pulse 2”, “; wave” or “; noise”");
    if (ended) return fail("Code after the channel's end: start a new channel section first");
    const track = tracks[ch]!;
    const kind = CHANNELS[ch].kind;
    const inst: Instrument = track.inst;
    const pitched = kind !== "noise";

    switch (command) {
      case "instrument": {
        if (!rest) return fail("instrument takes a preset name");
        track.inst = { ...instrument(kind, rest), preset: rest };
        return;
      }
      case "note_type": {
        const n = need(3);
        if (
          !n ||
          !range(n[0]!, 1, 16, "The step unit") ||
          !range(n[1]!, 0, 15, "The volume") ||
          !range(n[2]!, 0, 15, "The fade")
        )
          return;
        unit = n[0]!;
        inst.volume = n[1]!;
        inst.env = fadeEnv(n[2]!);
        return;
      }
      case "duty_cycle": {
        if (kind !== "pulse") return fail("duty_cycle only works on the pulse channels");
        const n = need(1);
        if (n && range(n[0]!, 0, 3, "The duty")) inst.duty = n[0]!;
        return;
      }
      case "vibrato": {
        if (!pitched) return fail("vibrato does not work on the noise channel");
        const n = need(3);
        if (
          n &&
          range(n[0]!, 0, 60, "The delay") &&
          range(n[1]!, 0, 15, "The depth") &&
          range(n[2]!, 1, 15, "The rate")
        )
          inst.vibrato = { delay: n[0]!, depth: n[1]!, rate: n[2]! };
        return;
      }
      case "pitch_glide": {
        if (!pitched) return fail("pitch_glide does not work on the noise channel");
        const n = need(1);
        if (n && range(n[0]!, 0, 30, "The glide")) inst.glide = n[0]!;
        return;
      }
      case "arpeggio": {
        if (!pitched) return fail("arpeggio does not work on the noise channel");
        const w = word(ARP_IDS, "The arpeggio");
        if (w) inst.arp = w as ArpId;
        return;
      }
      case "shimmer": {
        if (kind !== "pulse") return fail("shimmer only works on the pulse channels");
        const w = word(["on", "off"], "shimmer");
        if (w) inst.shimmer = w === "on";
        return;
      }
      case "note_length": {
        if (!pitched) return fail("note_length does not work on the noise channel");
        const w = word(GATES, "The note length");
        if (w) inst.gate = GATES.indexOf(w as (typeof GATES)[number]) as Instrument["gate"];
        return;
      }
      case "wave_shape": {
        if (kind !== "wave") return fail("wave_shape only works on the wave channel");
        const w = word(SHAPES, "The wave shape");
        if (w) inst.shape = w as WaveShape;
        return;
      }
      case "drum_tone": {
        if (kind !== "noise") return fail("drum_tone only works on the noise channel");
        const n = need(1);
        if (n && range(n[0]!, -3, 3, "The drum tone")) inst.tone = n[0]!;
        return;
      }
      case "stereo_panning": {
        const w = word(Object.values(PANS), "The panning");
        if (w) track.pan = (Object.keys(PANS) as Pan[]).find((p) => PANS[p] === w)!;
        return;
      }
      case "mute":
      case "solo":
        track[command] = true;
        return;
      case "octave": {
        if (!pitched) return fail("octave does not work on the noise channel: use drum_note");
        const n = need(1);
        if (n && range(n[0]!, 1, 8, "The octave")) octave = n[0]!;
        return;
      }
      case "rest": {
        const n = need(1);
        if (n && range(n[0]!, 1, 512, "The length")) at += n[0]! * unit;
        return;
      }
      case "note":
      case "drum_note": {
        if (command === "note" && !pitched)
          return fail("The noise channel plays drum_note, not note");
        if (command === "drum_note" && pitched)
          return fail("drum_note is for the noise channel; use note here");
        const [first, second] = args;
        if (args.length !== 2) return fail(`${command} takes two values, found ${args.length}`);
        const len = parseNumber(second!);
        if (len === undefined || !range(len, 1, 512, "The length")) return;
        let p: number;
        if (command === "note") {
          const k = NOTE_NAMES.findIndex((x) => x.toLowerCase() === first!.toLowerCase());
          if (k < 0) return fail(`“${first}” is not a note name (C_, C#, D_ … B_)`);
          p = (octave + 1) * 12 + k;
        } else {
          const d = parseNumber(first!);
          if (d === undefined || !range(d, 0, DRUMS.length - 1, "The drum")) return;
          p = d;
        }
        const note: Note = { s: at, l: command === "drum_note" ? 1 : len * unit, p };
        const own = /\bown (.*)$/.exec(comment);
        if (own) {
          for (const part of own[1]!.trim().split(/\s+/)) {
            const m = /^(dp|sl|v|e|d|w|t)(-?[\d.]+)$/.exec(part);
            if (!m) return fail(`“${part}” is not a note setting`);
            note[m[1] as (typeof NOTE_OVERRIDES)[number]] = Number(m[2]);
          }
        }
        placed.push({ line, ch, note });
        at += len * unit;
        return;
      }
      case "sound_loop":
      case "sound_ret":
        ended = true;
        return;
      default:
        return fail(`Unknown command “${command}”`);
    }
  });

  const total = bars * STEPS_PER_BAR;
  for (const { line, note } of placed) {
    if (note.s + note.l > total)
      errors.push({ line, message: `This note runs past the end of bar ${bars}` });
  }
  const loopSteps = new Set(loops.map((l) => l.step));
  if (loopSteps.size > 1)
    errors.push({
      line: loops[1]!.line,
      message: "The channels' .mainloop labels are in different bars",
    });
  const loopStep = loops[0]?.step ?? 0;
  if (loopStep >= total && loops[0])
    errors.push({ line: loops[0].line, message: "The loop starts after the end of the song" });
  if (errors.length) return { errors: errors.toSorted((a, b) => a.line - b.line) };

  const full = tracks.map((t, c) => {
    const track = t ?? {
      inst: instrument(CHANNELS[c]!.kind, ""),
      notes: [],
      mute: false,
      solo: false,
      pan: "C" as Pan,
    };
    track.notes = tidy(
      placed.filter((x) => x.ch === c).map((x) => x.note),
      total,
    );
    return track;
  }) as Song["tracks"];
  return {
    song: {
      v: 1,
      title,
      author,
      bpm,
      bars,
      loop: loopStep / STEPS_PER_BAR,
      key,
      scale,
      tracks: full,
    },
  };
}
