// The UI-side audio engine: owns the AudioContext and the worklet node, forwards song patches and
// transport commands, and exposes the telemetry the synth publishes.
import { signal } from "lumiose";
import type { Song } from "../model/types.ts";
import type { FromEngine, ProcessorOptions, ToEngine } from "./protocol.ts";
import { PROCESSOR } from "./protocol.ts";
import {
  createTelemetry,
  songDuration,
  telemetryBytes,
  type PlayMode,
  type Telemetry,
} from "./synth.ts";
import { encodeWav } from "./wav.ts";
import workletUrl from "./worklet.ts?worker&url";

export type EngineStatus = "off" | "starting" | "running" | "error";

export const engineStatus = signal<EngineStatus>("off");
/** How telemetry reaches the UI: shared memory, or a message ~60 times a second. */
export const telemetryMode = signal<"shared" | "message" | "none">("none");
export const audioInfo = signal({ sampleRate: 0, baseLatency: 0, outputLatency: 0 });

let context: AudioContext | undefined;
let node: AudioWorkletNode | undefined;
let telemetry: Telemetry | undefined;
let starting: Promise<void> | undefined;
let snapshot: () => Song = () => {
  throw new Error("engine: no song source");
};

/** Where the engine reads the full song from when it starts (a plain copy, not a proxy). */
export function setSongSource(source: () => Song): void {
  snapshot = source;
}

export function readTelemetry(): Telemetry | undefined {
  return telemetry;
}

/** Starts audio. Call from a user gesture (autoplay policy); later calls just resume. */
export function start(): Promise<void> {
  if (context && node) return context.state === "running" ? Promise.resolve() : context.resume();
  starting ??= boot().catch((error: unknown) => {
    engineStatus.set("error");
    starting = undefined;
    throw error;
  });
  return starting;
}

async function boot(): Promise<void> {
  engineStatus.set("starting");
  const ctx = new AudioContext({ latencyHint: "interactive" });
  await ctx.audioWorklet.addModule(workletUrl);
  const shared = typeof SharedArrayBuffer !== "undefined" && globalThis.crossOriginIsolated;
  const memory = shared ? new SharedArrayBuffer(telemetryBytes()) : undefined;
  const options: ProcessorOptions = { song: snapshot(), telemetry: memory };
  const worklet = new AudioWorkletNode(ctx, PROCESSOR, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    processorOptions: options,
  });
  worklet.connect(ctx.destination);
  if (memory) {
    telemetry = createTelemetry(memory);
  } else {
    // oxlint-disable-next-line unicorn/prefer-add-event-listener -- `onmessage` also starts the port
    worklet.port.onmessage = (event: MessageEvent<FromEngine>) => {
      telemetry = createTelemetry(event.data.buffer);
    };
  }
  telemetryMode.set(memory ? "shared" : "message");
  context = ctx;
  node = worklet;
  await ctx.resume();
  audioInfo.set({
    sampleRate: ctx.sampleRate,
    baseLatency: ctx.baseLatency,
    outputLatency: ctx.outputLatency,
  });
  engineStatus.set("running");
}

/** Sends a message if the engine runs; the full song is sent when it starts anyway. */
export function send(message: ToEngine): void {
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a MessagePort
  node?.port.postMessage(message);
}

export async function play(mode: PlayMode, order: number, row: number): Promise<void> {
  await start();
  send({ type: "play", mode, order, row });
}

export function stop(): void {
  send({ type: "stop" });
}

export function jam(channel: number, note: number, inst: number): void {
  void start().then(() => send({ type: "jam", channel, note, inst }));
}

export function jamOff(channel: number): void {
  send({ type: "jamOff", channel });
}

/** Renders one pass of the song (plus a release tail) offline and encodes it as a WAV file. */
export async function renderWav(song: Song, sampleRate = 44100): Promise<Blob> {
  const seconds = songDuration(song) + 1.5;
  const offline = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  await offline.audioWorklet.addModule(workletUrl);
  const options: ProcessorOptions = { song, render: true };
  const worklet = new AudioWorkletNode(offline, PROCESSOR, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    processorOptions: options,
  });
  worklet.connect(offline.destination);
  const rendered = await offline.startRendering();
  return new Blob([encodeWav(rendered)], { type: "audio/wav" });
}
