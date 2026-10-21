import type { EngineAudioData } from './types.ts';
export type CompiledEngineAudioEvent = {
    cycle: number;
    register: number;
    value: number;
    channelId: 1 | 2 | 3 | 4;
};
export type CompiledEngineAudioChannelTimeline = {
    channelId: 1 | 2 | 3 | 4;
    events: readonly CompiledEngineAudioEvent[];
    totalCycles: number;
    loopStartCycle: number | null;
    controls: readonly CompiledEngineAudioControl[];
};
export type CompiledEngineAudioControl = {
    cycle: number;
    commandIndex: number;
    kind: 'volume' | 'sfx_priority' | 'panning' | 'force_panning' | 'tempo';
    value: number;
};
export type CompiledEngineAudioTimeline = {
    channels: readonly CompiledEngineAudioChannelTimeline[];
    totalCycles: number;
};
export declare function compileEngineAudio(data: EngineAudioData): CompiledEngineAudioTimeline;
