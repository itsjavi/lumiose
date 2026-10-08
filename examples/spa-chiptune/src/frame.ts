// The single requestAnimationFrame loop: reads the engine telemetry once per frame, updates the
// transport signals (only when they change, so the pattern grid moves one row at a time), the
// meter signals, and draws every registered oscilloscope canvas directly.
import { batch, signal, type Signal } from "lumen";
import { readTelemetry } from "./audio/engine.ts";
import { HEADER, LEVELS, SCOPE_SIZE } from "./audio/synth.ts";

export const playing = signal(false);
export const playOrder = signal(0);
export const playRow = signal(0);
export const liveBpm = signal(0);
export const liveSpeed = signal(0);
/** Per-channel meter levels (0..1, quantized), then the master. */
export const levels: Signal<number>[] = Array.from({ length: LEVELS }, () => signal(0));

interface Scope {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  channel: number;
  color: string;
  blank: boolean;
}

const scopes = new Set<Scope>();

/** Registers a canvas to draw `channel`'s waveform on (the last channel is the master mix). */
export function registerScope(canvas: HTMLCanvasElement, channel: number): () => void {
  const context = canvas.getContext("2d");
  if (!context) return () => {};
  const scope: Scope = {
    canvas,
    context,
    channel,
    color: getComputedStyle(canvas).color,
    blank: false,
  };
  scopes.add(scope);
  // The silent midline until the engine reports audio, once the canvas is styled in the document.
  requestAnimationFrame(() => refreshScope(scope));
  return () => scopes.delete(scope);
}

const NO_DATA = new Float32Array(0);

/** Re-reads a scope's color and redraws it while it shows silence. */
function refreshScope(scope: Scope): void {
  scope.color = getComputedStyle(scope.canvas).color;
  if (scope.blank || !playing()) {
    scope.blank = false;
    drawScope(scope, NO_DATA, 0, true);
  }
}

/** Re-reads scope colors (after a theme change). */
export function refreshScopeColors(): void {
  for (const scope of scopes) refreshScope(scope);
}

const WINDOW = 1024;

function drawScope(scope: Scope, data: Float32Array, pos: number, silent: boolean): void {
  const { canvas, context, channel } = scope;
  const w = canvas.width;
  const h = canvas.height;
  if (silent) {
    if (scope.blank) return;
    scope.blank = true;
  } else {
    scope.blank = false;
  }
  context.clearRect(0, 0, w, h);
  context.fillStyle = scope.color;
  const base = channel * SCOPE_SIZE;
  const mid = h >> 1;
  if (silent) {
    context.fillRect(0, mid, w, 1);
    return;
  }
  // Trigger on a rising zero crossing in the older half so the waveform stands still.
  const mask = SCOPE_SIZE - 1;
  const oldest = (pos - WINDOW * 2) & mask;
  let start = (pos - WINDOW) & mask;
  for (let i = 1; i < WINDOW; i++) {
    const a = data[base + ((oldest + i - 1) & mask)]!;
    const b = data[base + ((oldest + i) & mask)]!;
    if (a < 0 && b >= 0) {
      start = (oldest + i) & mask;
      break;
    }
  }
  const scale = (h / 2 - 1) * 2.4;
  let previous = -1;
  for (let x = 0; x < w; x++) {
    const sample = data[base + ((start + Math.floor((x * WINDOW) / w)) & mask)]!;
    const y = Math.max(0, Math.min(h - 1, Math.round(mid - sample * scale)));
    const top = previous < 0 ? y : Math.min(y, previous);
    const bottom = previous < 0 ? y : Math.max(y, previous);
    context.fillRect(x, top, 1, bottom - top + 1);
    previous = y;
  }
}

// --- Frame timing ---

const SAMPLES = 600;
const intervals = new Float32Array(SAMPLES);
const work = new Float32Array(SAMPLES);
let count = 0;
let last = 0;

export interface FrameStats {
  frames: number;
  fps: number;
  avgInterval: number;
  p95Interval: number;
  maxInterval: number;
  /** Share of frames that took longer than 1.5 intervals at 60 Hz (25 ms). */
  slowFrames: number;
  avgWork: number;
  p95Work: number;
}

const percentile = (values: Float32Array, n: number, p: number) => {
  const sorted = values.subarray(0, n).toSorted();
  return sorted[Math.min(n - 1, Math.floor(n * p))] ?? 0;
};

/** Statistics over the last (up to) 600 frames. */
export function frameStats(): FrameStats {
  const n = Math.min(count, SAMPLES);
  let sum = 0;
  let sumWork = 0;
  let max = 0;
  let slow = 0;
  for (let i = 0; i < n; i++) {
    sum += intervals[i]!;
    sumWork += work[i]!;
    max = Math.max(max, intervals[i]!);
    if (intervals[i]! > 25) slow++;
  }
  return {
    frames: n,
    fps: n ? 1000 / (sum / n) : 0,
    avgInterval: n ? sum / n : 0,
    p95Interval: percentile(intervals, n, 0.95),
    maxInterval: max,
    slowFrames: n ? slow / n : 0,
    avgWork: n ? sumWork / n : 0,
    p95Work: percentile(work, n, 0.95),
  };
}

export function resetFrameStats(): void {
  count = 0;
}

export const fps = signal(0);
export const frameWork = signal(0);

function frame(now: number): void {
  const t0 = performance.now();
  const telemetry = readTelemetry();
  if (telemetry) {
    const { header, levels: peaks, scope } = telemetry;
    const isPlaying = header[HEADER.playing] === 1;
    batch(() => {
      playing.set(isPlaying);
      if (isPlaying) {
        playOrder.set(header[HEADER.order]!);
        playRow.set(header[HEADER.row]!);
        liveBpm.set(header[HEADER.bpm]!);
        liveSpeed.set(header[HEADER.speed]!);
      }
      for (let i = 0; i < LEVELS; i++)
        levels[i]!.set(Math.round(Math.min(1, peaks[i]! * 2) * 50) / 50);
    });
    const pos = header[HEADER.scopePos]!;
    for (const s of scopes) drawScope(s, scope, pos, peaks[s.channel]! < 0.002);
  }
  const elapsed = performance.now() - t0;
  if (last) {
    const i = count % SAMPLES;
    intervals[i] = now - last;
    work[i] = elapsed;
    count++;
    if (count % 30 === 0) {
      const stats = frameStats();
      fps.set(Math.round(stats.fps));
      frameWork.set(Math.round(stats.avgWork * 100) / 100);
    }
  }
  last = now;
  requestAnimationFrame(frame);
}

let started = false;
export function startFrameLoop(): void {
  if (started) return;
  started = true;
  requestAnimationFrame(frame);
}
