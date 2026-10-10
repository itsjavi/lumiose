// Playback. Each channel of a song renders to its own PCM stem in the worker; Web Audio plays the
// four stems in sync, loops the part after the loop bar, and mixes them with mute, solo and
// panning. An edit re-renders only the channels it changed, and the new stem takes over at the
// same position with a short crossfade, so playback continues while you edit.
import { signal } from "lumiose";
import type { EngineAudioData } from "../../vendor/gbapu/dist/index.js";
import { isAudible } from "../model/song.ts";
import type { ChannelIndex, Song } from "../model/types.ts";
import { loopSeconds, loops, songData, songSeconds, stepSeconds } from "./driver.ts";
import { SAMPLE_RATE } from "./protocol.ts";
import { encodeWav, renderPcm } from "./renderer.ts";

export type AudioStatus = "off" | "starting" | "on" | "error";

export const audioStatus = signal<AudioStatus>("off");
/** What is playing: "editor" for the studio's song, "demo:<id>" for a gallery preview. */
export const nowPlaying = signal<string | null>(null);
/** Stems are being rendered for playback. */
export const rendering = signal(false);
/** The step under the playhead, or -1 when stopped. */
export const playStep = signal(-1);
/** Loop after the end (back to the loop bar), or stop. */
export const looping = signal(true);
/** Milliseconds the last song render took (all changed channels). */
export const lastRenderMs = signal(0);

const CHANNELS = [0, 1, 2, 3] as const;

let ctx: AudioContext | undefined;
let master: GainNode | undefined;
let lanes: { gain: GainNode; left: GainNode; right: GainNode }[] = [];

/** Creates or resumes the AudioContext. Call it from a click or key press (autoplay policy). */
export async function unlock(): Promise<AudioContext> {
  if (!ctx) {
    audioStatus.set("starting");
    try {
      ctx = new AudioContext({ latencyHint: "interactive" });
      master = new GainNode(ctx, { gain: 0.9 });
      master.connect(ctx.destination);
      lanes = CHANNELS.map(() => {
        const merger = new ChannelMergerNode(ctx!, { numberOfInputs: 2 });
        const gain = new GainNode(ctx!);
        const left = new GainNode(ctx!);
        const right = new GainNode(ctx!);
        gain.connect(left).connect(merger, 0, 0);
        gain.connect(right).connect(merger, 0, 1);
        merger.connect(master!);
        return { gain, left, right };
      });
    } catch (error) {
      audioStatus.set("error");
      throw error;
    }
  }
  if (ctx.state !== "running") await ctx.resume();
  audioStatus.set(ctx.state === "running" ? "on" : "starting");
  return ctx;
}

// --- Stems ---

const stems = new Map<string, Promise<AudioBuffer>>();
const STEM_CACHE = 24;

function stemKey(song: Song, ch: ChannelIndex): string {
  const t = song.tracks[ch];
  return JSON.stringify([song.bpm, song.bars, song.loop, song.sheet, ch, t.inst, t.notes]);
}

function toBuffer(pcm: Float32Array): AudioBuffer {
  const buffer = new AudioBuffer({
    length: Math.max(1, pcm.length),
    sampleRate: SAMPLE_RATE,
    numberOfChannels: 1,
  });
  buffer.copyToChannel(pcm as Float32Array<ArrayBuffer>, 0);
  return buffer;
}

function stem(song: Song, ch: ChannelIndex): Promise<AudioBuffer> {
  const key = stemKey(song, ch);
  let entry = stems.get(key);
  if (entry) {
    stems.delete(key);
  } else {
    entry = renderPcm(songData(song, [ch]), { mono: true }).then(toBuffer);
    entry.catch(() => stems.delete(key));
  }
  stems.set(key, entry);
  while (stems.size > STEM_CACHE) stems.delete(stems.keys().next().value!);
  return entry;
}

/** Renders a song's four stems ahead of playing it (the gallery warms its demos with this). */
export async function prepare(song: Song): Promise<void> {
  const started = performance.now();
  await Promise.all(CHANNELS.map((ch) => stem(song, ch)));
  lastRenderMs.set(Math.round(performance.now() - started));
}

// --- Sessions ---

interface Voice {
  key: string;
  buffer: AudioBuffer;
  source: AudioBufferSourceNode;
  fade: GainNode;
}

interface Session {
  tag: string;
  song: Song;
  songSec: number;
  loopSec: number;
  /** Song position `pos` at context time `time`. */
  anchor: { time: number; pos: number };
  voices: (Voice | undefined)[];
  versions: number[];
}

let session: Session | undefined;
let frame = 0;
let token = 0;

function timing(song: Song) {
  return { songSec: songSeconds(song), loopSec: loopSeconds(song) };
}

/** The song position (seconds) at context time `t`, or undefined past the end without looping. */
function positionAt(s: Session, t: number): number | undefined {
  const raw = s.anchor.pos + (t - s.anchor.time);
  if (raw < s.songSec) return Math.max(0, raw);
  if (!looping.peek() || !loops(s.song)) return undefined;
  const body = s.songSec - s.loopSec;
  return body > 0 ? s.loopSec + ((raw - s.loopSec) % body) : 0;
}

/** The current song position in seconds, or -1 when stopped. */
export function position(): number {
  if (!session || !ctx) return -1;
  return positionAt(session, ctx.currentTime) ?? -1;
}

function startVoice(
  s: Session,
  ch: ChannelIndex,
  key: string,
  buffer: AudioBuffer,
  when: number,
  offset: number,
): Voice {
  const source = new AudioBufferSourceNode(ctx!, {
    buffer,
    loop: looping.peek() && loops(s.song) && s.songSec > s.loopSec,
    loopStart: s.loopSec,
    loopEnd: s.songSec,
  });
  const fade = new GainNode(ctx!, { gain: 0 });
  fade.gain.setTargetAtTime(1, when, 0.004);
  source.connect(fade).connect(lanes[ch]!.gain);
  source.start(when, Math.min(offset, Math.max(0, buffer.duration - 0.001)));
  return { key, buffer, source, fade };
}

function stopVoice(voice: Voice | undefined, when: number): void {
  if (!voice) return;
  voice.fade.gain.setTargetAtTime(0, when, 0.004);
  try {
    voice.source.stop(when + 0.04);
  } catch {
    // Already stopped.
  }
}

/** Mute, solo and pan of the song playing as `tag`, applied without re-rendering. */
export function applyMix(song: Song, tag: string): void {
  if (!ctx || session?.tag !== tag) return;
  const t = ctx.currentTime;
  song.tracks.forEach((track, ch) => {
    const lane = lanes[ch]!;
    lane.gain.gain.setTargetAtTime(isAudible(song, ch) ? 1 : 0, t, 0.01);
    lane.left.gain.setTargetAtTime(track.pan === "R" ? 0 : 1, t, 0.01);
    lane.right.gain.setTargetAtTime(track.pan === "L" ? 0 : 1, t, 0.01);
  });
}

/** Plays a song from `from` seconds. `tag` names what plays (see nowPlaying). */
export async function play(song: Song, tag: string, from = 0): Promise<void> {
  const mine = ++token;
  await unlock();
  stop();
  rendering.set(true);
  const started = performance.now();
  try {
    const keys = CHANNELS.map((ch) => stemKey(song, ch));
    const buffers = await Promise.all(CHANNELS.map((ch) => stem(song, ch)));
    lastRenderMs.set(Math.round(performance.now() - started));
    if (mine !== token) return;
    const when = ctx!.currentTime + 0.04;
    const s: Session = {
      tag,
      song,
      ...timing(song),
      anchor: { time: when, pos: from },
      voices: [],
      versions: [0, 0, 0, 0],
    };
    s.voices = CHANNELS.map((ch) => startVoice(s, ch, keys[ch]!, buffers[ch]!, when, from));
    session = s;
    applyMix(song, tag);
    nowPlaying.set(tag);
    tick();
  } finally {
    if (mine === token) rendering.set(false);
  }
}

export function stop(): void {
  cancelAnimationFrame(frame);
  if (session && ctx) for (const v of session.voices) stopVoice(v, ctx.currentTime);
  session = undefined;
  nowPlaying.set(null);
  playStep.set(-1);
}

/**
 * The song changed while it plays: mix changes apply at once; changed channels re-render and swap
 * in at the playing position; a tempo or length change re-anchors every channel on the same step.
 */
export async function update(song: Song, tag: string): Promise<void> {
  const s = session;
  if (!s || s.tag !== tag || !ctx) return;
  applyMix(song, tag);
  const before = s.song;
  s.song = song;
  const retimed =
    before.bpm !== song.bpm ||
    before.bars !== song.bars ||
    before.loop !== song.loop ||
    before.sheet?.ticks !== song.sheet?.ticks;
  const changed = CHANNELS.filter((ch) => retimed || s.voices[ch]?.key !== stemKey(song, ch));
  if (changed.length === 0) return;
  const versions = changed.map((ch) => ++s.versions[ch]!);
  const started = performance.now();
  const buffers = await Promise.all(changed.map((ch) => stem(song, ch)));
  lastRenderMs.set(Math.round(performance.now() - started));
  if (session !== s) return;
  const when = ctx.currentTime + 0.03;
  if (retimed) {
    const pos = positionAt(s, when) ?? 0;
    const oldStep = pos / stepSeconds(before);
    Object.assign(s, timing(song));
    const next = oldStep * stepSeconds(song);
    s.anchor = { time: when, pos: next < s.songSec ? next : s.loopSec };
  }
  const offset = positionAt(s, when);
  if (offset === undefined) return;
  changed.forEach((ch, i) => {
    if (s.versions[ch] !== versions[i]) return;
    stopVoice(s.voices[ch], when);
    s.voices[ch] = startVoice(s, ch, stemKey(song, ch), buffers[i]!, when, offset);
  });
  if (retimed) {
    // Channels that did not need a new stem still restart on the new anchor.
    for (const ch of CHANNELS) {
      if (changed.includes(ch)) continue;
      const v = s.voices[ch];
      if (!v) continue;
      stopVoice(v, when);
      s.voices[ch] = startVoice(s, ch, v.key, v.buffer, when, offset);
    }
  }
}

export function setLooping(on: boolean): void {
  looping.set(on);
  const s = session;
  if (!s || !ctx) return;
  if (!on) {
    // Re-anchor inside the current pass, so the song plays out to its end and stops.
    const pos = positionAt(s, ctx.currentTime) ?? 0;
    s.anchor = { time: ctx.currentTime, pos };
  }
  for (const v of s.voices) if (v) v.source.loop = on && loops(s.song) && s.songSec > s.loopSec;
}

function tick(): void {
  const s = session;
  if (!s || !ctx) return;
  const pos = positionAt(s, ctx.currentTime);
  if (pos === undefined) {
    stop();
    return;
  }
  const step = Math.floor(pos / stepSeconds(s.song));
  if (step !== playStep.peek()) playStep.set(step);
  frame = requestAnimationFrame(tick);
}

/** Samples of a channel around the playhead, for scopes; zeros when stopped or muted. */
export function scope(ch: ChannelIndex, out: Float32Array): number {
  out.fill(0);
  const s = session;
  if (!s || !ctx || !isAudible(s.song, ch)) return 0;
  const v = s.voices[ch];
  const pos = positionAt(s, ctx.currentTime);
  if (!v || pos === undefined) return 0;
  const data = v.buffer.getChannelData(0);
  const start = Math.max(0, Math.floor(pos * SAMPLE_RATE) - out.length);
  let sum = 0;
  for (let i = 0; i < out.length; i++) {
    const x = data[start + i] ?? 0;
    out[i] = x;
    sum += x * x;
  }
  return Math.sqrt(sum / out.length);
}

// --- One-shots ---

let shot: AudioBufferSourceNode | undefined;

/** Renders and plays a short sound (a note preview, an SFX). Resolves with its PCM. */
export async function playOnce(data: EngineAudioData): Promise<Float32Array> {
  await unlock();
  return playPcm(await renderPcm(data, { mono: true }));
}

/** Plays already rendered mono PCM once, cutting off the previous one-shot. */
export async function playPcm(pcm: Float32Array): Promise<Float32Array> {
  await unlock();
  const buffer = toBuffer(pcm);
  try {
    shot?.stop();
  } catch {
    // Already ended.
  }
  shot = new AudioBufferSourceNode(ctx!, { buffer });
  shot.connect(master!);
  shot.start();
  return buffer.getChannelData(0);
}

// --- Export ---

/**
 * The song as a stereo WAV file: the intro, then the loop twice, with RIFF `smpl` loop points on
 * the second pass (game engines loop it seamlessly). Mute, solo and panning apply.
 */
export async function songWav(song: Song): Promise<Blob> {
  const audible = CHANNELS.filter((ch) => isAudible(song, ch));
  const stemsPcm = await Promise.all(
    audible.map((ch) =>
      renderPcm(songData(song, [ch], { loop: true }), { mono: true, loopCount: 1 }),
    ),
  );
  const frames = Math.max(1, ...stemsPcm.map((p) => p.length));
  const out = new Float32Array(frames * 2);
  stemsPcm.forEach((pcm, i) => {
    const pan = song.tracks[audible[i]!].pan;
    const l = pan === "R" ? 0 : 0.9;
    const r = pan === "L" ? 0 : 0.9;
    for (let f = 0; f < pcm.length; f++) {
      const x = pcm[f]!;
      out[f * 2] = out[f * 2]! + x * l;
      out[f * 2 + 1] = out[f * 2 + 1]! + x * r;
    }
  });
  const intro = Math.round(loopSeconds(song) * SAMPLE_RATE);
  const body = Math.round((songSeconds(song) - loopSeconds(song)) * SAMPLE_RATE);
  const start = intro + body;
  const end = Math.min(frames, start + body);
  return encodeWav(out, end > start ? { start_frame: start, end_frame: end } : undefined);
}

/** Interleaved stereo PCM (mono duplicated) to WAV. */
export async function monoWav(pcm: Float32Array): Promise<Blob> {
  const out = new Float32Array(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) out[i * 2] = out[i * 2 + 1] = pcm[i]! * 0.9;
  return encodeWav(out);
}
