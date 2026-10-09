// Song helpers: building, copying, validating and editing notes.
import { instrument } from "./instruments.ts";
import {
  CHANNELS,
  MAX_BARS,
  STEPS_PER_BAR,
  type ChannelIndex,
  type Instrument,
  type Note,
  type Pan,
  type ScaleId,
  type Song,
  type SoundSheet,
  type Track,
} from "./types.ts";

export interface TrackSpec {
  preset: string;
  notes?: Note[];
  pan?: Pan;
  tweak?: Partial<Instrument>;
}

export interface SongSpec {
  title: string;
  author?: string;
  bpm: number;
  bars: number;
  loop?: number;
  key: number;
  scale: ScaleId;
  tracks: [TrackSpec, TrackSpec, TrackSpec, TrackSpec];
}

export function buildSong(spec: SongSpec): Song {
  const tracks = spec.tracks.map((t, ch): Track => {
    const inst = { ...instrument(CHANNELS[ch]!.kind, t.preset), ...t.tweak };
    return { inst, notes: t.notes ?? [], mute: false, solo: false, pan: t.pan ?? "C" };
  }) as Song["tracks"];
  return {
    v: 1,
    title: spec.title,
    author: spec.author ?? "Dotmatrix",
    bpm: spec.bpm,
    bars: spec.bars,
    loop: spec.loop ?? 0,
    key: spec.key,
    scale: spec.scale,
    tracks,
  };
}

export function emptySong(): Song {
  return buildSong({
    title: "New song",
    author: "",
    bpm: 120,
    bars: 4,
    key: 0,
    scale: "major",
    tracks: [{ preset: "hero" }, { preset: "echo" }, { preset: "round" }, { preset: "kit" }],
  });
}

export const clone = <T>(value: T): T => structuredClone(value);

const clamp = (v: unknown, lo: number, hi: number, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(hi, Math.max(lo, Math.round(v)))
    : fallback;

/**
 * Checks and repairs a song from outside (a shared URL, localStorage): every field is clamped to
 * its range and unknown fields are dropped. Throws when it is not a song at all.
 */
export function sanitizeSong(input: unknown): Song {
  if (!input || typeof input !== "object") throw new Error("Not a song");
  const raw = input as Partial<Song>;
  if (!Array.isArray(raw.tracks) || raw.tracks.length !== 4)
    throw new Error("A song has four tracks");
  const bars = clamp(raw.bars, 1, MAX_BARS, 4);
  const sheet = sanitizeSheet(raw.sheet);
  const total = bars * STEPS_PER_BAR;
  const tracks = raw.tracks.map((t, ch): Track => {
    const kind = CHANNELS[ch]!.kind;
    const fallback = instrument(kind, String(t?.inst?.preset ?? ""));
    const i = (t?.inst ?? {}) as Partial<Instrument>;
    const inst: Instrument = {
      preset: typeof i.preset === "string" ? i.preset.slice(0, 24) : fallback.preset,
      duty: clamp(i.duty, 0, 3, fallback.duty),
      volume: clamp(i.volume, 0, 15, fallback.volume),
      env: clamp(i.env, -7, 7, fallback.env),
      vibrato: {
        delay: clamp(i.vibrato?.delay, 0, 60, fallback.vibrato.delay),
        depth: clamp(i.vibrato?.depth, 0, 15, fallback.vibrato.depth),
        rate: clamp(i.vibrato?.rate, 1, 15, fallback.vibrato.rate),
      },
      glide: clamp(i.glide, 0, 30, fallback.glide),
      arp:
        (["off", "major", "minor", "fifth", "octave"] as const).find((a) => a === i.arp) ?? "off",
      shimmer: i.shimmer === true,
      gate: clamp(i.gate, 0, 2, fallback.gate) as Instrument["gate"],
      shape:
        (["soft", "triangle", "saw", "square", "organ", "hollow"] as const).find(
          (s) => s === i.shape,
        ) ?? fallback.shape,
      tone: clamp(i.tone, -3, 3, fallback.tone),
    };
    // On a sound sheet, noise notes are raw noise settings (0–255) and may be longer than a step.
    const drums = kind === "noise" && !sheet;
    const range = drums
      ? [0, 7]
      : kind === "noise"
        ? [0, 255]
        : kind === "wave"
          ? [24, 108]
          : [36, 120];
    const notes = (Array.isArray(t?.notes) ? t.notes : [])
      .filter((n): n is Note => !!n && typeof n === "object" && Number(n.s) < total)
      .map((n) => {
        const note: Note = {
          s: clamp(n.s, 0, total - 1, 0),
          l: drums ? 1 : clamp(n.l, 1, total, 1),
          p: clamp(n.p, range[0]!, range[1]!, range[0]!),
        };
        if (n.v !== undefined) note.v = clamp(n.v, 0, 15, 12);
        if (n.e !== undefined) note.e = clamp(n.e, -7, 7, 0);
        if (n.d !== undefined) note.d = clamp(n.d, 0, 3, 2);
        if (n.w !== undefined) note.w = clamp(n.w, -7, 7, 0);
        if (n.dp !== undefined) note.dp = clamp(n.dp, 0, 255, 0);
        if (n.sl !== undefined) note.sl = clamp(n.sl, -128, 128, 0);
        if (typeof n.t === "number" && Number.isFinite(n.t))
          note.t = Math.min(0.5, Math.max(-0.5, n.t));
        return note;
      })
      .slice(0, 2048);
    const pan = (["L", "C", "R"] as const).find((p) => p === t?.pan) ?? "C";
    return { inst, notes: tidy(notes, total), mute: t?.mute === true, solo: t?.solo === true, pan };
  }) as Song["tracks"];
  return {
    v: 1,
    title: typeof raw.title === "string" ? raw.title.slice(0, 60) : "Untitled",
    author: typeof raw.author === "string" ? raw.author.slice(0, 60) : "",
    bpm: clamp(raw.bpm, 50, 240, 120),
    bars,
    loop: clamp(raw.loop, 0, bars - 1, 0),
    key: clamp(raw.key, 0, 11, 0),
    scale:
      (
        [
          "major",
          "minor",
          "harmonicMinor",
          "dorian",
          "pentatonic",
          "minorPentatonic",
          "chromatic",
        ] as const
      ).find((s) => s === raw.scale) ?? "major",
    tracks,
    ...(sheet ? { sheet } : {}),
  };
}

function sanitizeSheet(input: unknown): SoundSheet | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as Partial<SoundSheet>;
  return {
    kind: raw.kind === "voice" ? "voice" : "sfx",
    name: typeof raw.name === "string" ? raw.name.slice(0, 60) : "Sound",
    ticks: clamp(raw.ticks, 1, 8, 1),
  };
}

/** Sorts notes and keeps one note at a time (a later note cuts an earlier one short). */
export function tidy(notes: readonly Note[], total: number): Note[] {
  const sorted = notes
    .filter((n) => n.s >= 0 && n.s < total)
    .map((n) => ({ ...n, l: Math.max(1, Math.min(n.l, total - n.s)) }))
    .toSorted((a, b) => a.s - b.s);
  const out: Note[] = [];
  for (const note of sorted) {
    const last = out.at(-1);
    if (last && last.s === note.s) out.pop();
    else if (last && last.s + last.l > note.s) last.l = note.s - last.s;
    out.push(note);
  }
  return out;
}

/** The note sounding at `step` on a track, if any. */
export function noteAt(notes: readonly Note[], step: number): Note | undefined {
  return notes.find((n) => n.s <= step && step < n.s + n.l);
}

/** Places a note: it replaces whatever it overlaps (channels play one note at a time). */
export function placeNote(notes: readonly Note[], note: Note, total: number): Note[] {
  const end = note.s + note.l;
  const kept = notes.flatMap((n): Note[] => {
    const nEnd = n.s + n.l;
    if (nEnd <= note.s || n.s >= end) return [n];
    if (n.s < note.s) return [{ ...n, l: note.s - n.s }];
    return [];
  });
  return tidy([...kept, note], total);
}

export function removeNote(notes: readonly Note[], note: Note): Note[] {
  return notes.filter((n) => !(n.s === note.s && n.p === note.p));
}

/** Copies bars [from, from+count) over the bars starting at `to`, on every track. */
export function copyBars(song: Song, from: number, count: number, to: number): Song["tracks"] {
  const a = from * STEPS_PER_BAR;
  const b = (from + count) * STEPS_PER_BAR;
  const shift = (to - from) * STEPS_PER_BAR;
  const total = song.bars * STEPS_PER_BAR;
  const tStart = to * STEPS_PER_BAR;
  const tEnd = tStart + count * STEPS_PER_BAR;
  return song.tracks.map((track) => {
    const outside = track.notes.filter((n) => n.s + n.l <= tStart || n.s >= tEnd);
    const copied = track.notes
      .filter((n) => n.s >= a && n.s < b)
      .map((n) => ({ ...n, s: n.s + shift, l: Math.min(n.l, b - n.s) }));
    return { ...track, notes: tidy([...outside, ...copied], total) };
  }) as Song["tracks"];
}

/** Removes the notes that start in bars [from, from+count). */
export function clearBars(
  song: Song,
  from: number,
  count: number,
  channels: readonly ChannelIndex[],
): Song["tracks"] {
  const a = from * STEPS_PER_BAR;
  const b = (from + count) * STEPS_PER_BAR;
  return song.tracks.map((track, ch) =>
    channels.includes(ch as ChannelIndex)
      ? { ...track, notes: track.notes.filter((n) => n.s < a || n.s >= b) }
      : track,
  ) as Song["tracks"];
}

export const isAudible = (song: Song, ch: number): boolean => {
  const anySolo = song.tracks.some((t) => t.solo);
  const t = song.tracks[ch]!;
  return anySolo ? t.solo : !t.mute;
};
