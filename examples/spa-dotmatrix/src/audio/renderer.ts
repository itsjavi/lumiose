// The UI side of rendering: a small pool of render workers and a promise per request.
import type { EngineAudioData } from "../../vendor/gbaudio/dist/index.js";
import type { FromWorker, ToWorker } from "./protocol.ts";

type Pending = {
  resolve: (msg: FromWorker & { ok: true }) => void;
  reject: (error: Error) => void;
};

const POOL = 2;
const workers: Worker[] = [];
const pending = new Map<number, Pending>();
let nextId = 1;
let turn = 0;

function worker(): Worker {
  if (workers.length < POOL) {
    const w = new Worker(new URL("./render.worker.ts", import.meta.url), {
      type: "module",
      name: "gbaudio",
    });
    w.addEventListener("message", (event: MessageEvent<FromWorker>) => {
      const msg = event.data;
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.ok) entry.resolve(msg);
      else entry.reject(new Error(msg.error));
    });
    workers.push(w);
  }
  return workers[turn++ % workers.length]!;
}

type Request = ToWorker extends infer M ? (M extends ToWorker ? Omit<M, "id"> : never) : never;

function request(
  message: Request,
  transfer: Transferable[] = [],
): Promise<FromWorker & { ok: true }> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker().postMessage({ ...message, id }, transfer);
  });
}

/** Renders a command stream to PCM: mono for stems, interleaved stereo otherwise. */
export async function renderPcm(
  data: EngineAudioData,
  options: { mono: boolean; loopCount?: number },
): Promise<Float32Array> {
  const reply = await request({
    type: "render",
    data,
    mono: options.mono,
    loopCount: options.loopCount ?? 0,
  });
  return reply.pcm!;
}

/** Encodes interleaved stereo PCM as a WAV file (with optional loop points). */
export async function encodeWav(
  pcm: Float32Array,
  loop?: { start_frame: number; end_frame: number },
): Promise<Blob> {
  const reply = await request({ type: "wav", pcm, loop }, [pcm.buffer]);
  return new Blob([reply.wav!], { type: "audio/wav" });
}
