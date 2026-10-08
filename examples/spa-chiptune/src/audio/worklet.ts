// The AudioWorklet processor: hosts the Synth on the audio thread. Loaded with `?worker&url`, so
// Vite bundles it (and the synth) as a standalone ES module.
import type { FromEngine, ProcessorOptions, ToEngine } from "./protocol.ts";
import { PROCESSOR } from "./protocol.ts";
import { createTelemetry, Synth, telemetryBytes } from "./synth.ts";

// AudioWorkletGlobalScope globals (not in TypeScript's DOM lib).
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: AudioWorkletNodeOptions);
}
declare function registerProcessor(
  name: string,
  processor: new (options: AudioWorkletNodeOptions) => AudioWorkletProcessor,
): void;

class ChipProcessor extends AudioWorkletProcessor {
  private readonly synth: Synth;
  private readonly buffer: ArrayBuffer | SharedArrayBuffer;
  private readonly shared: boolean;
  private readonly postEvery: number;
  private blocks = 0;

  constructor(options: AudioWorkletNodeOptions) {
    super(options);
    const opts = options.processorOptions as ProcessorOptions;
    this.shared = opts.telemetry !== undefined;
    this.buffer = opts.telemetry ?? new ArrayBuffer(telemetryBytes());
    this.synth = new Synth(opts.song, sampleRate, createTelemetry(this.buffer));
    // About 60 Hz: one post every ~16 ms of 128-frame blocks (never while exporting offline).
    this.postEvery = opts.render ? Infinity : Math.max(1, Math.round(sampleRate / 128 / 60));
    if (opts.render) this.synth.play("once", 0, 0);
    this.port.onmessage = (event: MessageEvent<ToEngine>) => this.receive(event.data);
  }

  private receive(message: ToEngine): void {
    const synth = this.synth;
    switch (message.type) {
      case "song":
        synth.setSong(message.song);
        break;
      case "set":
        synth.set(message.path, message.value);
        break;
      case "play":
        synth.play(message.mode, message.order, message.row);
        break;
      case "stop":
        synth.stop();
        break;
      case "jam":
        synth.jam(message.channel, message.note, message.inst);
        break;
      case "jamOff":
        synth.jamOff(message.channel);
        break;
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0];
    const left = out?.[0];
    if (!out || !left) return true;
    this.synth.render(left, out[1] ?? left, left.length);
    if (!this.shared && ++this.blocks >= this.postEvery) {
      this.blocks = 0;
      const copy = (this.buffer as ArrayBuffer).slice(0);
      this.port.postMessage({ type: "telemetry", buffer: copy } satisfies FromEngine, [copy]);
    }
    return true;
  }
}

registerProcessor(PROCESSOR, ChipProcessor);
