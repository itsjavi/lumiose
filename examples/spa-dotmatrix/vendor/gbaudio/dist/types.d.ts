import type { EngineAudioRegisterToken, EngineAudioValueToken } from './audio-command-tokens.ts';
export type AudioCategory = 'music' | 'sfx' | 'cries' | 'generated';
export type EngineAudioChannelId = 1 | 2 | 3 | 4;
/**
 * Audio write instruction.
 *
 * Format: `[register, value]`
 * - `register`: register token like `n21`, `n22`, `w30`
 * - `value`: raw byte value or token aliases for drum/noise constants.
 *   Prefix legend for value tokens:
 *   - `sn` = snare
 *   - `dr` = drum
 *   - `tr` = triangle
 *   - `hh` = hi-hat
 *   - `ki` = kick
 *   - `cr` = crash
 */
export type EngineAudioWriteCommand = readonly [
    register: EngineAudioRegisterToken,
    value: number | EngineAudioValueToken
];
/**
 * Audio sleep/wait virtual instruction.
 *
 * Format: `['wait', cycles]`
 */
export type EngineAudioWaitCommand = readonly [instruction: 'wait', cycles: number];
/**
 * Audio end virtual instruction.
 *
 * Format: `['end']`
 */
export type EngineAudioEndCommand = readonly [instruction: 'end'];
/** Source driver control; it changes arbitration rather than an APU register. */
export type EngineAudioPriorityCommand = readonly [instruction: 'sfx_priority', enabled: 0 | 1];
/** Conditional source panning differs from forced routing when mono is selected. */
export type EngineAudioPanningCommand = readonly [instruction: 'stereo_panning' | 'force_stereo_panning', tracks: number];
export type EngineAudioTempoCommand = readonly [instruction: 'tempo', value: number];
/** Optional source-unit program for roles whose future timing can change while retained. */
export type PulseDriverProgram = {
    schema_version: 1;
    source_label: string;
    frequency_table: readonly number[];
    commands: readonly (readonly (string | number)[])[];
};
export type EngineAudioCommand = EngineAudioWriteCommand | EngineAudioWaitCommand | EngineAudioEndCommand | EngineAudioPriorityCommand | EngineAudioPanningCommand | EngineAudioTempoCommand;
export type EngineAudioChannelData = {
    id: EngineAudioChannelId;
    sourceChannel?: number;
    label?: string;
    loopStartCommandIndex?: number;
    commands: readonly EngineAudioCommand[];
    /** Original note/rest parses, excluding synthesized held-note register writes. */
    sourceNoteCommandIndices?: readonly number[];
    pulse_driver?: PulseDriverProgram;
};
export type EngineAudioMetadata = {
    id: string;
    name: string;
    category: AudioCategory;
    sourceLabel: string;
    /** Ordinal in the pinned source pointer table, independent of the namespaced ID. */
    sourceIndex?: number;
};
export type EngineAudioData = EngineAudioMetadata & {
    channels: readonly EngineAudioChannelData[];
};
export type EngineAudioCatalogEntry = EngineAudioMetadata & {
    load: () => Promise<EngineAudioData>;
};
