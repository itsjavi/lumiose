// The NES-style synth and sequencer. Plain TypeScript over plain song data, with no Web Audio:
// it runs inside the AudioWorklet (live playback and the offline WAV export) and in unit tests.
import { getAt, setAt } from "../model/song.ts";
import {
  CHANNELS,
  NOTE_CUT,
  NOTE_MAX,
  NOTE_OFF,
  type Cell,
  type ChannelKind,
  type Instrument,
  type Macro,
  type Path,
  type Song,
} from "../model/types.ts";

export const CPU_HZ = 1789773;
/** NTSC noise timer periods, in CPU cycles, from highest to lowest pitch. */
const NOISE_PERIODS = [4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068];
const DUTIES = [0.125, 0.25, 0.5, 0.75];
/** The 32-step, 4-bit triangle sequence, normalized to -1..1. */
const TRIANGLE = Float32Array.from({ length: 32 }, (_, i) => (i < 16 ? 15 - i : i - 16) / 7.5 - 1);
/** Output weight of each voice at full volume (roughly the NES mixer's linear approximation). */
const WEIGHT: Record<ChannelKind, number> = { pulse: 0.3, triangle: 0.36, noise: 0.24 };

export type PlayMode = "song" | "pattern" | "once";

/** Seconds per tick at `bpm` (ProTracker timing: 125 BPM is 50 ticks per second). */
export const tickSeconds = (bpm: number): number => 2.5 / bpm;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function nextMacroPos(m: Macro, pos: number, released: boolean): number {
  const len = m.values.length;
  let next = pos + 1;
  if (!released && m.release >= 0) {
    if (next > m.release) next = m.loop >= 0 && m.loop <= m.release ? m.loop : m.release;
  } else if (next >= len) {
    next = m.loop >= 0 && (m.release < 0 || m.loop > m.release) ? m.loop : len - 1;
  }
  return clamp(next, 0, len - 1);
}

const releasePos = (m: Macro, pos: number) =>
  m.release >= 0 ? clamp(m.release + 1, 0, m.values.length - 1) : pos;

/** PolyBLEP residual for a unit step at phase 0 (t in 0..1, dt the phase increment). */
function blep(t: number, dt: number): number {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

export class Voice {
  readonly kind: ChannelKind;
  // Sequencer state.
  inst = 0;
  note = -1;
  active = false;
  released = false;
  /** Channel volume 0..15 (volume column and Axy). */
  volume = 15;
  /** Vxx duty, used when the instrument has no duty macro. */
  duty = 2;
  /** Current pitch in 1/16 semitones (slides and portamento move it). */
  pitch = 0;
  portaTarget = -1;
  // Persistent effects.
  arp = 0;
  arpTick = 0;
  slideUp = 0;
  slideDown = 0;
  porta = 0;
  vibSpeed = 0;
  vibDepth = 0;
  vibPhase = 0;
  volSlide = 0;
  cutIn = -1;
  // Macro positions.
  mVol = 0;
  mArp = 0;
  mPitch = 0;
  mDuty = 0;
  pitchAcc = 0;
  // Per-tick outputs.
  outVol = 0;
  outHz = 0;
  outDuty = 0.5;
  noiseRate = 0;
  noiseShort = false;
  // Oscillators.
  phase = 0;
  lfsr = 1;
  noiseAcc = 0;
  // Mixer: channel gain (volume, mute, solo) and constant-power pan.
  gain = 0.8;
  panL = Math.SQRT1_2;
  panR = Math.SQRT1_2;

  constructor(kind: ChannelKind) {
    this.kind = kind;
  }

  reset(): void {
    this.active = false;
    this.released = false;
    this.volume = 15;
    this.duty = 2;
    this.arp = this.slideUp = this.slideDown = this.porta = 0;
    this.vibSpeed = this.vibDepth = this.vibPhase = this.volSlide = 0;
    this.cutIn = -1;
    this.portaTarget = -1;
    this.outVol = 0;
  }

  trigger(note: number): void {
    this.note = note;
    this.pitch = note * 16;
    this.portaTarget = -1;
    this.active = true;
    this.released = false;
    this.mVol = this.mArp = this.mPitch = this.mDuty = 0;
    this.pitchAcc = 0;
    this.arpTick = 0;
  }

  release(ins: Instrument | undefined): void {
    if (!this.active || this.released) return;
    this.released = true;
    if (!ins || ins.volume.release < 0) {
      this.active = false;
      return;
    }
    this.mVol = releasePos(ins.volume, this.mVol);
    this.mArp = releasePos(ins.arpeggio, this.mArp);
    this.mPitch = releasePos(ins.pitch, this.mPitch);
    this.mDuty = releasePos(ins.duty, this.mDuty);
  }

  /** Applies a pattern cell at the first tick of its row. */
  apply(cell: Cell, song: Song): void {
    if (cell.inst >= 0) this.inst = cell.inst;
    if (cell.vol >= 0) this.volume = cell.vol;
    const p = cell.param;
    switch (cell.fx) {
      case "0":
        this.arp = p;
        break;
      case "1":
        this.slideUp = p;
        this.slideDown = this.porta = 0;
        break;
      case "2":
        this.slideDown = p;
        this.slideUp = this.porta = 0;
        break;
      case "3":
        this.porta = p;
        this.slideUp = this.slideDown = 0;
        break;
      case "4":
        this.vibSpeed = p >> 4;
        this.vibDepth = p & 15;
        break;
      case "A":
        this.volSlide = (p >> 4) - (p & 15);
        break;
      case "V":
        this.duty = p & 3;
        break;
      case "S":
        this.cutIn = p;
        break;
    }
    const note = cell.note;
    if (note >= 0 && note <= NOTE_MAX) {
      if (this.porta > 0 && this.active && !this.released) this.portaTarget = note * 16;
      else this.trigger(note);
      this.note = note;
    } else if (note === NOTE_OFF) {
      this.release(song.instruments[this.inst]);
    } else if (note === NOTE_CUT) {
      this.active = false;
    }
  }

  /** Advances effects and macros by one tick and computes the oscillator settings. */
  tick(song: Song): void {
    if (this.cutIn >= 0) {
      if (this.cutIn === 0) this.active = false;
      this.cutIn--;
    }
    if (!this.active) {
      this.outVol = 0;
      return;
    }
    const ins = song.instruments[this.inst];
    // Effects.
    if (this.volSlide !== 0) this.volume = clamp(this.volume + this.volSlide / 8, 0, 15);
    if (this.portaTarget >= 0) {
      const d = this.portaTarget - this.pitch;
      this.pitch = Math.abs(d) <= this.porta ? this.portaTarget : this.pitch + Math.sign(d) * this.porta;
    } else if (this.slideUp || this.slideDown) {
      this.pitch = clamp(this.pitch + this.slideUp - this.slideDown, 0, NOTE_MAX * 16);
    }
    let vib = 0;
    if (this.vibDepth > 0) {
      vib = Math.sin((this.vibPhase / 64) * 2 * Math.PI) * this.vibDepth * 1.5;
      this.vibPhase = (this.vibPhase + this.vibSpeed) & 63;
    }
    let arpOffset = 0;
    if (this.arp > 0) {
      const step = this.arpTick % 3;
      arpOffset = step === 0 ? 0 : step === 1 ? this.arp >> 4 : this.arp & 15;
      this.arpTick++;
    }
    // Macros.
    let vm = 15;
    let am = 0;
    let duty = this.duty;
    if (ins) {
      const rel = this.released;
      if (ins.volume.values.length) {
        vm = ins.volume.values[this.mVol]!;
        this.mVol = nextMacroPos(ins.volume, this.mVol, rel);
      }
      if (ins.arpeggio.values.length) {
        am = ins.arpeggio.values[this.mArp]!;
        this.mArp = nextMacroPos(ins.arpeggio, this.mArp, rel);
      }
      if (ins.pitch.values.length) {
        this.pitchAcc += ins.pitch.values[this.mPitch]!;
        this.mPitch = nextMacroPos(ins.pitch, this.mPitch, rel);
      }
      if (ins.duty.values.length) {
        duty = ins.duty.values[this.mDuty]!;
        this.mDuty = nextMacroPos(ins.duty, this.mDuty, rel);
      }
    }
    const v = this.volume > 0 && vm > 0 ? Math.max(1, Math.round((this.volume * vm) / 15)) : 0;
    // The triangle has no volume control: it is either on or off.
    this.outVol = this.kind === "triangle" ? (v > 0 ? 15 : 0) : v;
    const pitch = this.pitch + (arpOffset + am) * 16 + this.pitchAcc + vib;
    if (this.kind === "noise") {
      const index = ((Math.round(pitch / 16) % 16) + 16) % 16;
      this.noiseRate = CPU_HZ / NOISE_PERIODS[15 - index]!;
      this.noiseShort = (duty & 1) === 1;
    } else {
      this.outHz = 440 * 2 ** ((pitch / 16 - 57) / 12);
      this.outDuty = DUTIES[duty & 3]!;
    }
  }

  /** One output sample, -1..1 scaled by volume and voice weight. */
  sample(sampleRate: number): number {
    if (this.outVol === 0) return 0;
    const amp = (this.outVol / 15) * WEIGHT[this.kind];
    if (this.kind === "noise") {
      this.noiseAcc += this.noiseRate / sampleRate;
      while (this.noiseAcc >= 1) {
        this.noiseAcc -= 1;
        const bit = (this.lfsr ^ (this.lfsr >> (this.noiseShort ? 6 : 1))) & 1;
        this.lfsr = (this.lfsr >> 1) | (bit << 14);
      }
      return this.lfsr & 1 ? -amp : amp;
    }
    const dt = Math.min(this.outHz / sampleRate, 0.5);
    let t = this.phase + dt;
    if (t >= 1) t -= 1;
    this.phase = t;
    if (this.kind === "triangle") return TRIANGLE[(t * 32) | 0]! * amp;
    const d = this.outDuty;
    let y = t < d ? 1 : -1;
    y += blep(t, dt);
    let t2 = t - d;
    if (t2 < 0) t2 += 1;
    y -= blep(t2, dt);
    return y * amp;
  }
}

/** The order/row/tick state machine, shared by playback and `songDuration`. */
export class Sequencer {
  mode: PlayMode = "song";
  order = 0;
  row = 0;
  tick = 0;
  speed = 6;
  bpm = 150;
  ended = false;
  private jump: { order: number; row: number } | null = null;

  start(song: Song, mode: PlayMode, order: number, row: number): void {
    this.mode = mode;
    this.order = clamp(order, 0, song.order.length - 1);
    this.row = clamp(row, 0, song.patternLength - 1);
    this.tick = 0;
    this.speed = song.speed;
    this.bpm = song.bpm;
    this.ended = false;
    this.jump = null;
  }

  cells(song: Song): Cell[] | undefined {
    return song.patterns[song.order[this.order] ?? -1]?.rows[this.row];
  }

  /** Applies the song-level effects of a row (Fxx, Bxx, Dxx). */
  rowEffects(cells: Cell[]): void {
    for (const cell of cells) {
      const p = cell.param;
      if (cell.fx === "F" && p > 0) {
        if (p < 0x20) this.speed = p;
        else this.bpm = p;
      } else if (cell.fx === "B") {
        this.jump = { order: p, row: this.jump?.row ?? 0 };
      } else if (cell.fx === "D") {
        this.jump = { order: this.jump?.order ?? this.order + 1, row: p };
      }
    }
  }

  /** Moves to the next row; in "once" mode, ends instead of looping. */
  nextRow(song: Song): void {
    let order = this.order;
    let row = this.row + 1;
    if (this.jump) {
      row = this.jump.row;
      if (this.mode !== "pattern") order = this.jump.order;
      this.jump = null;
    }
    if (row >= song.patternLength) {
      row = 0;
      if (this.mode !== "pattern") order++;
    }
    if (order >= song.order.length) order = 0;
    if (this.mode === "once" && (order < this.order || (order === this.order && row <= this.row))) {
      this.ended = true;
      return;
    }
    this.order = order;
    this.row = row;
  }
}

/** Length of one pass through the song, in seconds (follows Fxx, Bxx and Dxx). */
export function songDuration(song: Song, limit = 600): number {
  const seq = new Sequencer();
  seq.start(song, "once", 0, 0);
  let seconds = 0;
  while (!seq.ended && seconds < limit) {
    const cells = seq.cells(song);
    if (cells) seq.rowEffects(cells);
    seconds += seq.speed * tickSeconds(seq.bpm);
    seq.nextRow(song);
  }
  return Math.min(seconds, limit);
}

export const SCOPE_SIZE = 2048;
export const LEVELS = CHANNELS.length + 1;

/** Shared telemetry views: the synth writes them, the UI reads them every frame. */
export interface Telemetry {
  /** [counter, playing, order, row, scopePos, tick, ended, bpm, speed] */
  header: Int32Array;
  /** Per-channel peak levels (decaying), then the master. */
  levels: Float32Array;
  /** Ring buffers of SCOPE_SIZE samples: one per channel, then the master. */
  scope: Float32Array;
}

export const HEADER = {
  counter: 0,
  playing: 1,
  order: 2,
  row: 3,
  scopePos: 4,
  tick: 5,
  ended: 6,
  bpm: 7,
  speed: 8,
} as const;
const HEADER_INTS = 16;

export function telemetryBytes(): number {
  return HEADER_INTS * 4 + LEVELS * 4 + LEVELS * SCOPE_SIZE * 4;
}

export function createTelemetry(buffer: ArrayBufferLike = new ArrayBuffer(telemetryBytes())): Telemetry {
  return {
    header: new Int32Array(buffer, 0, HEADER_INTS),
    levels: new Float32Array(buffer, HEADER_INTS * 4, LEVELS),
    scope: new Float32Array(buffer, HEADER_INTS * 4 + LEVELS * 4, LEVELS * SCOPE_SIZE),
  };
}

export class Synth {
  song: Song;
  readonly sampleRate: number;
  readonly voices: Voice[];
  readonly seq = new Sequencer();
  readonly telemetry: Telemetry;
  playing = false;
  master = 0.8;
  private untilTick = 0;
  private dcX = [0, 0];
  private dcY = [0, 0];
  private readonly dcR: number;
  private readonly levelDecay: number;
  private readonly peaks = new Float32Array(LEVELS);

  constructor(song: Song, sampleRate: number, telemetry: Telemetry = createTelemetry()) {
    this.song = song;
    this.sampleRate = sampleRate;
    this.telemetry = telemetry;
    this.voices = CHANNELS.map((c) => new Voice(c.kind));
    this.dcR = 1 - (2 * Math.PI * 20) / sampleRate;
    this.levelDecay = Math.exp(-128 / sampleRate / 0.12);
    this.updateMix();
  }

  setSong(song: Song): void {
    this.song = song;
    this.stop();
    this.updateMix();
  }

  /** Applies one patch from the editor. */
  set(path: Path, value: unknown): void {
    if (path.length === 0) return;
    setAt(this.song, path, value);
    if (path[0] === "mixer") this.updateMix();
  }

  get(path: Path): unknown {
    return getAt(this.song, path);
  }

  updateMix(): void {
    const { channels, master } = this.song.mixer;
    const solo = channels.some((c) => c.solo);
    this.master = master;
    this.voices.forEach((voice, i) => {
      const mix = channels[i]!;
      const on = !mix.mute && (!solo || mix.solo);
      voice.gain = on ? mix.volume : 0;
      // Constant-power pan, unity at the center.
      const angle = ((mix.pan + 1) / 4) * Math.PI;
      voice.panL = Math.cos(angle) * Math.SQRT2;
      voice.panR = Math.sin(angle) * Math.SQRT2;
    });
  }

  play(mode: PlayMode, order = 0, row = 0): void {
    for (const voice of this.voices) voice.reset();
    this.seq.start(this.song, mode, order, row);
    this.playing = true;
    this.untilTick = 0;
  }

  stop(): void {
    this.playing = false;
    for (const voice of this.voices) voice.reset();
  }

  /** Plays a note on a channel outside the sequence (keyboard preview). */
  jam(channel: number, note: number, inst: number): void {
    const voice = this.voices[channel];
    if (!voice) return;
    voice.inst = inst;
    voice.volume = 15;
    voice.trigger(note);
    voice.tick(this.song);
  }

  jamOff(channel: number): void {
    const voice = this.voices[channel];
    if (voice) voice.release(this.song.instruments[voice.inst]);
  }

  private doTick(): void {
    const seq = this.seq;
    if (this.playing && seq.tick === 0) {
      const cells = seq.cells(this.song);
      if (cells) {
        seq.rowEffects(cells);
        cells.forEach((cell, i) => this.voices[i]?.apply(cell, this.song));
      }
    }
    for (const voice of this.voices) voice.tick(this.song);
    if (this.playing && ++seq.tick >= seq.speed) {
      seq.tick = 0;
      seq.nextRow(this.song);
      if (seq.ended) {
        this.playing = false;
        for (const voice of this.voices) voice.release(this.song.instruments[voice.inst]);
      }
    }
  }

  /** Renders `frames` stereo samples into the output arrays and updates the telemetry. */
  render(left: Float32Array, right: Float32Array, frames = left.length): void {
    const { header, levels, scope } = this.telemetry;
    const voices = this.voices;
    const count = voices.length;
    const sr = this.sampleRate;
    const peaks = this.peaks;
    peaks.fill(0);
    let pos = header[HEADER.scopePos]!;
    const tickLength = sr * tickSeconds(this.playing ? this.seq.bpm : this.song.bpm);
    for (let i = 0; i < frames; i++) {
      if (this.untilTick <= 0) {
        this.doTick();
        this.untilTick += tickLength;
      }
      this.untilTick--;
      let l = 0;
      let r = 0;
      for (let c = 0; c < count; c++) {
        const voice = voices[c]!;
        // Meters and scopes are post-fader: a muted channel reads silent.
        const s = voice.sample(sr) * voice.gain;
        scope[c * SCOPE_SIZE + pos] = s;
        const a = s < 0 ? -s : s;
        if (a > peaks[c]!) peaks[c] = a;
        l += s * voice.panL;
        r += s * voice.panR;
      }
      // DC blocker, master gain and a soft clip.
      const yl = l - this.dcX[0]! + this.dcR * this.dcY[0]!;
      const yr = r - this.dcX[1]! + this.dcR * this.dcY[1]!;
      this.dcX[0] = l;
      this.dcX[1] = r;
      this.dcY[0] = yl;
      this.dcY[1] = yr;
      const ol = Math.tanh(yl * this.master);
      const or = Math.tanh(yr * this.master);
      left[i] = ol;
      right[i] = or;
      const m = (ol + or) * 0.5;
      scope[count * SCOPE_SIZE + pos] = m;
      const am = m < 0 ? -m : m;
      if (am > peaks[count]!) peaks[count] = am;
      pos = (pos + 1) & (SCOPE_SIZE - 1);
    }
    const decay = this.levelDecay ** (frames / 128);
    for (let c = 0; c < LEVELS; c++) {
      const held = levels[c]! * decay;
      levels[c] = peaks[c]! > held ? peaks[c]! : held;
    }
    header[HEADER.scopePos] = pos;
    header[HEADER.playing] = this.playing ? 1 : 0;
    header[HEADER.order] = this.seq.order;
    header[HEADER.row] = this.seq.row;
    header[HEADER.tick] = this.seq.tick;
    header[HEADER.ended] = this.seq.ended ? 1 : 0;
    header[HEADER.bpm] = this.seq.bpm;
    header[HEADER.speed] = this.seq.speed;
    header[HEADER.counter] = (header[HEADER.counter]! + 1) | 0;
  }
}
