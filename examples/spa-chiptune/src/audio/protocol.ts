// Messages between the UI thread (engine.ts) and the AudioWorklet (worklet.ts).
import type { Path, Song } from "../model/types.ts";
import type { PlayMode } from "./synth.ts";

export const PROCESSOR = "lumiose-chip";

export interface ProcessorOptions {
  song: Song;
  /** Telemetry memory shared with the UI, when the page is cross-origin isolated. */
  telemetry?: SharedArrayBuffer;
  /** Offline export: play the song once from the start. */
  render?: boolean;
}

export type ToEngine =
  | { type: "song"; song: Song }
  | { type: "set"; path: Path; value: unknown }
  | { type: "play"; mode: PlayMode; order: number; row: number }
  | { type: "stop" }
  | { type: "jam"; channel: number; note: number; inst: number }
  | { type: "jamOff"; channel: number };

/** Sent about 60 times a second when telemetry is not shared: a copy of the telemetry memory. */
export type FromEngine = { type: "telemetry"; buffer: ArrayBuffer };
