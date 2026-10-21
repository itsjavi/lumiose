import type { EngineAudioData } from './types.ts';
export type EngineAudioExportOptions = {
    sampleRate?: number;
    loopCount?: number;
    tailMs?: number;
    /** Exact render horizon, continuously repeating all channels with source loops. */
    durationCycles?: number;
};
export type EngineAudioRenderResult = {
    sampleRate: number;
    interleavedStereo: Float32Array;
};
export declare function renderEngineAudioToPcm(data: EngineAudioData, options?: EngineAudioExportOptions): EngineAudioRenderResult;
export declare function renderEngineAudioToWavBlob(data: EngineAudioData, options?: EngineAudioExportOptions): Blob;
export declare function encodeInterleavedStereoPcm16Wav(interleavedStereo: Float32Array, sampleRate: number, loop?: {
    start_frame: number;
    end_frame: number;
}): ArrayBuffer;
