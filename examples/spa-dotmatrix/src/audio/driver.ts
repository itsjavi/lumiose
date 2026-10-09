// The Dotmatrix sound driver: turns songs and SFX into gbapu command streams (register writes and
// waits in CPU cycles). It works like a Game Boy game's music driver: notes start on step
// boundaries, and once per video frame (70,224 cycles, ~59.7 Hz) it updates vibrato, slides,
// arpeggios, duty cycle patterns and the wave channel's volume steps.
import type {
  EngineAudioChannelData,
  EngineAudioCommand,
  EngineAudioData,
  EngineAudioRegisterToken,
} from "../../vendor/gbapu/dist/index.js";
import { DRUMS } from "../model/instruments.ts";
import { hz } from "../model/music.ts";
import {
  CHANNELS,
  STEPS_PER_BAR,
  type ArpId,
  type ChannelIndex,
  type Instrument,
  type Note,
  type Sfx,
  type SfxNote,
  type Song,
  type Track,
} from "../model/types.ts";
import { KIT, noiseByte, waveBytes } from "./tables.ts";

export const CPU_HZ = 4_194_304;
/** One video frame: the driver's tick. */
export const FRAME = 70_224;
export const FPS = CPU_HZ / FRAME;

type Write = readonly [EngineAudioRegisterToken, number];
interface TimedWrites {
  /** Absolute time in CPU cycles (fractional; rounded when emitted). */
  t: number;
  writes: Write[];
}

/** CPU cycles per 16th-note step. */
export const stepCycles = (bpm: number): number => (CPU_HZ * 15) / bpm;
export const songSteps = (song: Song): number => song.bars * STEPS_PER_BAR;
/** CPU cycles per step of a song: a 16th note, or `ticks` frames on a sound sheet. */
export const songStepCycles = (song: Pick<Song, "bpm" | "sheet">): number =>
  song.sheet ? song.sheet.ticks * FRAME : stepCycles(song.bpm);
export const stepSeconds = (song: Pick<Song, "bpm" | "sheet">): number =>
  songStepCycles(song) / CPU_HZ;
export const songSeconds = (song: Song): number => songSteps(song) * stepSeconds(song);
/** Where the loop starts; sound sheets play once and have no loop. */
export const loopSeconds = (song: Song): number =>
  song.sheet ? 0 : song.loop * STEPS_PER_BAR * stepSeconds(song);
export const loops = (song: Song): boolean => !song.sheet;

// --- Register values ---

/** NRx2: start volume, direction and pace from the signed `env` (see Instrument.env). */
export function envByte(volume: number, env: number): number {
  const v = Math.min(15, Math.max(0, Math.round(volume)));
  if (env === 0) return v << 4;
  const pace = Math.min(7, Math.max(1, 8 - Math.abs(Math.round(env))));
  return (v << 4) | (env < 0 ? 0x08 : 0) | pace;
}

/** The 11-bit frequency register of a pulse (divider 131072) or wave (65536) channel. */
export function freqReg(midi: number, wave: boolean): number {
  const x = Math.round(2048 - (wave ? 65536 : 131072) / hz(midi));
  return Math.min(2047, Math.max(0, x));
}

/** NR32 output level: 1 = 100 %, 2 = 50 %, 3 = 25 %, 0 = mute. */
export function waveLevel(volume: number): number {
  return volume >= 12 ? 1 : volume >= 6 ? 2 : volume >= 1 ? 3 : 0;
}

/** NR10 from a signed sweep amount: positive rises, negative falls, bigger is faster. */
export function sweepByte(sweep: number): number {
  const m = Math.min(7, Math.abs(Math.round(sweep)));
  if (m === 0) return 0;
  const pace = m >= 5 ? 1 : m >= 3 ? 2 : 3;
  const shift = m >= 6 ? 2 : m >= 4 ? 3 : m >= 2 ? 4 : 5;
  return (pace << 4) | (sweep < 0 ? 0x08 : 0) | shift;
}

const ARPS: Record<ArpId, readonly number[]> = {
  off: [0],
  major: [0, 4, 7],
  minor: [0, 3, 7],
  fifth: [0, 7],
  octave: [0, 12],
};

const GATES = [1, 0.8, 0.45] as const;

/** A triangle LFO, -1…1, starting at 0 and rising. */
function triangle(phase: number): number {
  const x = phase - Math.floor(phase);
  return x < 0.25 ? 4 * x : x < 0.75 ? 2 - 4 * x : 4 * x - 4;
}

/** The pitch (fractional MIDI) of frame `f` of a note. */
export function framePitch(inst: Instrument, pitch: number, f: number, from?: number): number {
  let p = pitch;
  if (from !== undefined && inst.glide > 0 && f < inst.glide)
    p = from + (pitch - from) * (f / inst.glide);
  const arp = ARPS[inst.arp];
  p += arp[f % arp.length]!;
  const { delay, depth, rate } = inst.vibrato;
  if (depth > 0 && f >= delay) p += triangle((f - delay) / (Math.max(1, rate) * 4)) * depth * 0.06;
  return p;
}

// --- Notes ---

/** Sorted, clipped to the song, one note at a time, and split where the loop starts. */
export function normalizeNotes(notes: readonly Note[], total: number, loopStep: number): Note[] {
  const sorted = notes
    .filter((n) => n.s >= 0 && n.s < total && n.l > 0)
    .map((n) => ({ ...n, l: Math.min(n.l, total - n.s) }))
    .toSorted((a, b) => a.s - b.s);
  const mono: Note[] = [];
  for (const note of sorted) {
    const last = mono.at(-1);
    if (last && last.s === note.s) mono.pop();
    else if (last && last.s + last.l > note.s) last.l = note.s - last.s;
    mono.push(note);
  }
  if (loopStep <= 0) return mono;
  return mono.flatMap((n) =>
    n.s < loopStep && n.s + n.l > loopStep
      ? [
          { ...n, l: loopStep - n.s },
          { ...n, s: loopStep, l: n.s + n.l - loopStep },
        ]
      : [n],
  );
}

const PULSE_REGS = {
  1: { duty: "n11", env: "n12", lo: "n13", hi: "n14" },
  2: { duty: "n16", env: "n17", lo: "n18", hi: "n19" },
} as const;

/** Register writes for one track over `total` steps. */
function trackWrites(
  track: Track,
  ch: ChannelIndex,
  sc: number,
  total: number,
  loopStep: number,
  sheet: boolean,
): TimedWrites[] {
  const kind = CHANNELS[ch].kind;
  const inst = track.inst;
  const end = total * sc;
  const notes = normalizeNotes(track.notes, total, loopStep);
  const out: TimedWrites[] = [];
  const at = (t: number, ...writes: Write[]) => out.push({ t: Math.min(t, end - 1), writes });

  if (kind === "noise" && sheet) {
    // On a sound sheet a noise note is one raw noise setting, held until the next note.
    notes.forEach((note, i) => {
      const next = notes[i + 1];
      at(
        note.s * sc,
        ["n21", envByte(note.v ?? inst.volume, note.e ?? inst.env)],
        ["n22", note.p & 0xff],
        ["n23", 0x80],
      );
      if (!next || next.s > note.s + note.l) at((note.s + note.l) * sc, ["n21", 0]);
    });
    return out;
  }

  if (kind === "noise") {
    notes.forEach((note, i) => {
      const program = KIT[note.p] ?? KIT[0]!;
      const stop = (notes[i + 1]?.s ?? total) * sc;
      let t = note.s * sc;
      for (const step of program) {
        if (t >= stop) break;
        const vol = Math.min(15, Math.max(1, Math.round((step.vol * inst.volume) / 12)));
        at(t, ["n21", (vol << 4) | step.pace], ["n22", noiseByte(step, inst.tone)], ["n23", 0x80]);
        t += step.frames * FRAME;
      }
    });
    return out;
  }

  const wave = kind === "wave";
  const pulse = PULSE_REGS[ch === 0 ? 1 : 2];
  const lo = wave ? "n1d" : pulse.lo;
  const hi = wave ? "n1e" : pulse.hi;
  const freq = (x: number, trigger: boolean): Write[] => [
    [lo, x & 0xff],
    [hi, (trigger ? 0x80 : 0) | (x >> 8)],
  ];
  if (wave) {
    const ram = waveBytes(inst.shape).map((byte, i): Write => [
      `w3${i.toString(16)}` as EngineAudioRegisterToken,
      byte,
    ]);
    at(0, ["n1a", 0], ...ram, ["n1a", 0x80], ["n1c", 0]);
  } else {
    if (ch === 0) at(0, ["n10", 0]);
    at(0, [pulse.env, 0]);
  }
  const startLevel = waveLevel(inst.volume);
  const gate = GATES[inst.gate];

  notes.forEach((note, i) => {
    const prev = notes[i - 1];
    const next = notes[i + 1];
    const t0 = note.s * sc;
    const t1 = (note.s + note.l) * sc;
    const touchesNext = next !== undefined && next.s === note.s + note.l;
    const from =
      prev && prev.s + prev.l === note.s && note.s !== loopStep
        ? prev.p + (prev.t ?? 0)
        : undefined;
    const pitch = note.p + (note.t ?? 0);
    const volume = note.v ?? inst.volume;
    const env = note.e ?? inst.env;
    const base = note.d ?? inst.duty;
    const pattern = [base, base, base === 2 ? 1 : 2, base === 2 ? 1 : 2];
    const release = gate === 1 && touchesNext ? undefined : t0 + Math.max(FRAME, (t1 - t0) * gate);
    const until = release ?? t1;

    let x = freqReg(framePitch(inst, pitch, 0, from), wave);
    let duty = base;
    const top = note.v === undefined ? startLevel : waveLevel(note.v);
    let level = env < 0 && top !== 0 ? 3 : top;
    if (wave) at(t0, ["n1c", level << 5], ...freq(x, true));
    else
      at(
        t0,
        ...(ch === 0 ? [["n10", sweepByte(note.w ?? 0)] as Write] : []),
        [pulse.duty, duty << 6],
        [pulse.env, envByte(volume, env)],
        ...freq(x, true),
      );

    for (let f = 1; t0 + f * FRAME < until; f++) {
      const writes: Write[] = [];
      const nx = freqReg(framePitch(inst, pitch, f, from), wave);
      // A hardware sweep moves the frequency itself: the driver leaves it alone.
      if (nx !== x && !note.w) writes.push(...freq((x = nx), false));
      if (!wave && inst.shimmer && pattern[f % 4] !== duty) {
        duty = pattern[f % 4]!;
        writes.push([pulse.duty, duty << 6]);
      }
      if (wave && env !== 0 && level !== 0) {
        // The wave channel has no envelope: the driver steps its output level instead.
        const every = (8 - Math.min(7, Math.abs(env))) * 3;
        const stepped = env > 0 ? (level === 3 ? 0 : level + 1) : Math.max(top, level - 1);
        if (f % every === 0 && stepped !== level) writes.push(["n1c", (level = stepped) << 5]);
      }
      if (writes.length) at(t0 + f * FRAME, ...writes);
    }
    if (release !== undefined) at(release, wave ? ["n1c", 0] : [pulse.env, 0]);
  });
  return out;
}

/** Writes in time order as gbapu commands, with a loop marker at `loopAt` cycles. */
function toCommands(
  events: TimedWrites[],
  total: number,
  loopAt: number | null,
): { commands: EngineAudioCommand[]; loopStartCommandIndex?: number } {
  const sorted = events.map((e, i) => ({ ...e, i })).toSorted((a, b) => a.t - b.t || a.i - b.i);
  const commands: EngineAudioCommand[] = [];
  let cursor = 0;
  let loopIndex: number | undefined;
  const advance = (to: number) => {
    if (to > cursor) {
      commands.push(["wait", to - cursor]);
      cursor = to;
    }
  };
  for (const event of sorted) {
    const t = Math.min(Math.round(event.t), total - 1);
    if (loopAt !== null && loopIndex === undefined && t >= loopAt) {
      advance(loopAt);
      loopIndex = commands.length;
    }
    advance(t);
    commands.push(...event.writes);
  }
  if (loopAt !== null && loopIndex === undefined) {
    advance(loopAt);
    loopIndex = commands.length;
  }
  advance(total);
  commands.push(["end"]);
  return loopIndex === undefined ? { commands } : { commands, loopStartCommandIndex: loopIndex };
}

export interface StemOptions {
  /** Add a loop marker at the song's loop bar (for renders that repeat). */
  loop?: boolean;
}

/** One channel of a song as a gbapu channel stream: one pass, intro included. */
export function channelData(
  song: Song,
  ch: ChannelIndex,
  options: StemOptions = {},
): EngineAudioChannelData {
  const total = songSteps(song);
  const loopStep = loops(song) ? Math.min(song.loop, song.bars - 1) * STEPS_PER_BAR : 0;
  const sc = songStepCycles(song);
  const totalCycles = Math.round(total * sc);
  const events = trackWrites(song.tracks[ch], ch, sc, total, loopStep, !!song.sheet);
  const loopAt = options.loop && loops(song) ? Math.round(loopStep * sc) : null;
  return {
    id: CHANNELS[ch].hw,
    label: CHANNELS[ch].name,
    ...toCommands(events, totalCycles, loopAt),
  };
}

export function songData(
  song: Song,
  channels: readonly ChannelIndex[],
  options: StemOptions = {},
): EngineAudioData {
  return {
    id: "dotmatrix:song",
    name: song.title || "Untitled",
    category: "music",
    sourceLabel: "Dotmatrix",
    channels: channels.map((ch) => channelData(song, ch, options)),
  };
}

/** A single note on a track's instrument, for auditioning while editing. */
export function noteData(
  track: Track,
  ch: ChannelIndex,
  pitch: number,
  steps: number,
  timing: Pick<Song, "bpm" | "sheet">,
): EngineAudioData {
  const sc = songStepCycles(timing);
  const drum = CHANNELS[ch].kind === "noise" && !timing.sheet;
  // Short steps (a frame on a sheet) would make an inaudible preview: hold it for ~0.2 s.
  const len = drum ? 1 : Math.max(steps, Math.ceil((0.2 * CPU_HZ) / sc));
  const total = Math.max(len, drum ? 4 : len);
  const single: Track = { ...track, notes: [{ s: 0, l: len, p: pitch }] };
  const events = trackWrites(single, ch, sc, total, 0, !!timing.sheet);
  return {
    id: "dotmatrix:note",
    name: "note",
    category: "generated",
    sourceLabel: "Dotmatrix",
    channels: [{ id: CHANNELS[ch].hw, ...toCommands(events, Math.round(total * sc), null) }],
  };
}

// --- SFX ---

/** Frames of a voice. */
export const voiceFrames = (notes: readonly SfxNote[]): number =>
  notes.reduce((sum, n) => sum + n.frames, 0);

export function sfxFrames(sfx: Sfx): number {
  return Math.max(1, ...sfx.voices.map((v) => voiceFrames(v.notes)));
}

/** An SFX as gbapu channels: each step retriggers its channel, like Crystal's square/noise notes. */
export function sfxData(sfx: Sfx): EngineAudioData {
  const total = sfxFrames(sfx) * FRAME;
  return {
    id: `dotmatrix:sfx:${sfx.id}`,
    name: sfx.name,
    category: "sfx",
    sourceLabel: "Dotmatrix",
    channels: sfx.voices.map((voice) => {
      const events: TimedWrites[] = [];
      let t = 0;
      for (const note of voice.notes) {
        if (note.volume === 0) {
          // A rest silences the channel without retriggering it.
          const env = voice.channel === 3 ? "n21" : PULSE_REGS[voice.channel === 0 ? 1 : 2].env;
          events.push({ t, writes: [[env, 0]] });
        } else if (voice.channel === 3) {
          events.push({
            t,
            writes: [
              ["n21", envByte(note.volume, note.env)],
              ["n22", note.noise & 0xff],
              ["n23", 0x80],
            ],
          });
        } else {
          const regs = PULSE_REGS[voice.channel === 0 ? 1 : 2];
          const x = freqReg(note.pitch, false);
          const writes: Write[] = [];
          if (voice.channel === 0) writes.push(["n10", sweepByte(note.sweep)]);
          writes.push(
            [regs.duty, (note.duty & 3) << 6],
            [regs.env, envByte(note.volume, note.env)],
            [regs.lo, x & 0xff],
            [regs.hi, 0x80 | (x >> 8)],
          );
          events.push({ t, writes });
        }
        t += note.frames * FRAME;
      }
      const silence: Write =
        voice.channel === 3 ? ["n21", 0] : [PULSE_REGS[voice.channel === 0 ? 1 : 2].env, 0];
      events.push({ t: Math.max(0, t - 1), writes: [silence] });
      return { id: CHANNELS[voice.channel].hw, ...toCommands(events, Math.max(total, t), null) };
    }),
  };
}

export const drumName = (p: number): string => DRUMS[p]?.name ?? "Drum";
