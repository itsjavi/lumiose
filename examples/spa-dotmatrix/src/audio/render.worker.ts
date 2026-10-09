// The render worker: runs the vendored gbapu engine offline, so the UI never waits on synthesis.
// It renders a command stream to PCM (mono for song stems: a channel is routed to both sides) and
// encodes WAV files.
import {
  encodeInterleavedStereoPcm16Wav,
  renderEngineAudioToPcm,
} from "../../vendor/gbapu/dist/index.js";
import { SAMPLE_RATE, type FromWorker, type ToWorker } from "./protocol.ts";

function reply(message: FromWorker, transfer: Transferable[] = []): void {
  (self as unknown as Worker).postMessage(message, transfer);
}

self.addEventListener("message", (event: MessageEvent<ToWorker>) => {
  const msg = event.data;
  const started = performance.now();
  try {
    if (msg.type === "render") {
      const { interleavedStereo } = renderEngineAudioToPcm(msg.data, {
        sampleRate: SAMPLE_RATE,
        loopCount: msg.loopCount,
        tailMs: 0,
      });
      let pcm = interleavedStereo;
      if (msg.mono) {
        pcm = new Float32Array(interleavedStereo.length / 2);
        for (let i = 0; i < pcm.length; i++) pcm[i] = interleavedStereo[i * 2]!;
      }
      reply({ id: msg.id, ok: true, pcm, ms: performance.now() - started }, [pcm.buffer]);
    } else {
      const wav = encodeInterleavedStereoPcm16Wav(msg.pcm, SAMPLE_RATE, msg.loop);
      reply({ id: msg.id, ok: true, wav, ms: performance.now() - started }, [wav]);
    }
  } catch (error) {
    reply({ id: msg.id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
