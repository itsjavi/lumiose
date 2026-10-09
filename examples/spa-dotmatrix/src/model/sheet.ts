// Sound sheets: a sound effect or creature voice as a studio song on a frame grid (one step per
// video frame), and back. Every detail the grid cannot show (per-note volume, envelope, duty,
// hardware sweep, fine tuning) travels as per-note settings, so the conversion is lossless. Going
// back to the maker only works when the sheet uses nothing the maker cannot express; otherwise the
// reasons are listed and the sound stays a sheet.
import { buildSong } from "./song.ts";
import {
  CHANNELS,
  MAX_BARS,
  STEPS_PER_BAR,
  type Note,
  type Sfx,
  type SfxNote,
  type SfxVoice,
  type Song,
  type SoundSheet,
} from "./types.ts";

export type SheetResult = { song: Song } | { reasons: string[] };

const voiceFrames = (notes: readonly SfxNote[]) => notes.reduce((sum, n) => sum + n.frames, 0);

/** An SFX (or voice) as a studio song on a frame grid. */
export function sfxToSheet(sfx: Sfx, kind: SoundSheet["kind"]): SheetResult {
  const frames = Math.max(1, ...sfx.voices.map((v) => voiceFrames(v.notes)));
  const bars = Math.ceil(frames / STEPS_PER_BAR);
  if (bars > MAX_BARS)
    return {
      reasons: [`it is ${frames} frames long; the studio holds ${MAX_BARS * STEPS_PER_BAR}`],
    };
  const song = buildSong({
    title: sfx.name,
    author: "",
    bpm: 120,
    bars,
    key: 0,
    scale: "chromatic",
    tracks: [
      {
        preset: "custom",
        tweak: { preset: "custom", gate: 0, env: 0, vibrato: { delay: 0, depth: 0, rate: 3 } },
      },
      {
        preset: "custom",
        tweak: { preset: "custom", gate: 0, env: 0, vibrato: { delay: 0, depth: 0, rate: 3 } },
      },
      { preset: "round" },
      { preset: "custom", tweak: { preset: "custom", env: 0, tone: 0 } },
    ],
  });
  song.sheet = { kind, name: sfx.name, ticks: 1 };
  for (const voice of sfx.voices) {
    const track = song.tracks[voice.channel];
    const first = voice.notes.find((n) => n.volume > 0);
    if (!first) continue;
    Object.assign(track.inst, { volume: first.volume, env: first.env, duty: first.duty });
    const notes: Note[] = [];
    let at = 0;
    for (const n of voice.notes) {
      if (n.volume > 0) {
        const note: Note =
          voice.channel === 3
            ? { s: at, l: n.frames, p: n.noise }
            : { s: at, l: n.frames, p: Math.round(n.pitch) };
        if (n.volume !== track.inst.volume) note.v = n.volume;
        if (n.env !== track.inst.env) note.e = n.env;
        if (voice.channel !== 3) {
          if (n.duty !== track.inst.duty) note.d = n.duty;
          if (voice.channel === 0 && n.sweep !== 0) note.w = n.sweep;
          const tune = Math.round((n.pitch - note.p) * 1000) / 1000;
          if (tune !== 0) note.t = tune;
        }
        notes.push(note);
      }
      at += n.frames;
    }
    track.notes = notes;
  }
  return { song };
}

/** Why a sheet cannot go back to the maker, if it cannot. */
export function sheetLimits(song: Song): string[] {
  if (!song.sheet) return ["it is a song, not a sound sheet"];
  const reasons: string[] = [];
  song.tracks.forEach((track, ch) => {
    if (track.notes.length === 0) return;
    const name = CHANNELS[ch]!.name;
    const i = track.inst;
    if (ch === 2) reasons.push("it uses the Wave channel (sound effects use the pulses and noise)");
    if (ch === 2 || ch === 3) return;
    if (i.vibrato.depth > 0) reasons.push(`${name} has vibrato`);
    if (i.glide > 0) reasons.push(`${name} glides between notes`);
    if (i.arp !== "off") reasons.push(`${name} plays an arpeggio`);
    if (i.shimmer) reasons.push(`${name} uses shimmer`);
    if (i.gate !== 0) reasons.push(`${name} shortens its notes (note length is not Legato)`);
  });
  return reasons;
}

/** A sheet back as an SFX for the maker, or the reasons it cannot be one. */
export function sheetToSfx(song: Song, id: string): { sfx: Sfx } | { reasons: string[] } {
  const reasons = sheetLimits(song);
  if (reasons.length) return { reasons };
  const ticks = song.sheet!.ticks;
  const voices: SfxVoice[] = [];
  for (const ch of [0, 1, 3] as const) {
    const track = song.tracks[ch];
    if (track.notes.length === 0) continue;
    const i = track.inst;
    const notes: SfxNote[] = [];
    let at = 0;
    for (const n of track.notes.toSorted((a, b) => a.s - b.s)) {
      if (n.s > at)
        notes.push({
          frames: (n.s - at) * ticks,
          volume: 0,
          env: 0,
          pitch: 60,
          duty: i.duty,
          sweep: 0,
          noise: 0,
        });
      notes.push({
        frames: n.l * ticks,
        volume: n.v ?? i.volume,
        env: n.e ?? i.env,
        pitch: ch === 3 ? 0 : n.p + (n.t ?? 0),
        duty: ch === 3 ? 0 : (n.d ?? i.duty),
        sweep: ch === 0 ? (n.w ?? 0) : 0,
        noise: ch === 3 ? n.p : 0,
      });
      at = n.s + n.l;
    }
    voices.push({ channel: ch, notes });
  }
  const name = song.sheet!.name || song.title;
  return { sfx: { id, name, blurb: "Your own sound, made in the studio.", voices } };
}
