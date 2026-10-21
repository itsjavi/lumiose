// Messages between the UI and the render worker.
import type { EngineAudioData } from "../../vendor/gbaudio/dist/index.js";

export const SAMPLE_RATE = 48_000;

export type ToWorker =
  | { type: "render"; id: number; data: EngineAudioData; loopCount: number; mono: boolean }
  | {
      type: "wav";
      id: number;
      pcm: Float32Array;
      loop?: { start_frame: number; end_frame: number };
    };

export type FromWorker =
  | { id: number; ok: true; pcm?: Float32Array; wav?: ArrayBuffer; ms: number }
  | { id: number; ok: false; error: string };
