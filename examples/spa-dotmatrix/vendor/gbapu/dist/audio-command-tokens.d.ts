/**
 * Human-readable register tokens used in authored/generated audio command streams.
 * Tokens follow original GB register names in lowercase:
 * - `n10`..`n52` => NR10..NR52
 * - `w30`..`w3f` => wave RAM addresses $30..$3F
 */
export declare const AUDIO_REGISTER_TOKEN_TO_VALUE: {
    readonly n10: 16;
    readonly n11: 17;
    readonly n12: 18;
    readonly n13: 19;
    readonly n14: 20;
    readonly n16: 22;
    readonly n17: 23;
    readonly n18: 24;
    readonly n19: 25;
    readonly n1a: 26;
    readonly n1b: 27;
    readonly n1c: 28;
    readonly n1d: 29;
    readonly n1e: 30;
    readonly n20: 32;
    readonly n21: 33;
    readonly n22: 34;
    readonly n23: 35;
    readonly n24: 36;
    readonly n25: 37;
    readonly n26: 38;
    readonly w30: 48;
    readonly w31: 49;
    readonly w32: 50;
    readonly w33: 51;
    readonly w34: 52;
    readonly w35: 53;
    readonly w36: 54;
    readonly w37: 55;
    readonly w38: 56;
    readonly w39: 57;
    readonly w3a: 58;
    readonly w3b: 59;
    readonly w3c: 60;
    readonly w3d: 61;
    readonly w3e: 62;
    readonly w3f: 63;
};
export type EngineAudioRegisterToken = keyof typeof AUDIO_REGISTER_TOKEN_TO_VALUE;
/**
 * Drum/sample tokens sourced from `src-gbc/audio/drumkits.asm`.
 *
 * Prefix legend:
 * - `sn` = snare
 * - `dr` = drum
 * - `tr` = triangle
 * - `hh` = hi-hat
 * - `ki` = kick
 * - `cr` = crash
 *
 * Each token maps to its first-step channel 4 parameters:
 * - `n21` (NR42 envelope)
 * - `n22` (NR43 poly/frequency)
 */
export declare const AUDIO_DRUM_TOKEN_TO_VALUES: {
    readonly dr00: {
        readonly n21: 17;
        readonly n22: 0;
    };
    readonly sn01: {
        readonly n21: 193;
        readonly n22: 51;
    };
    readonly sn02: {
        readonly n21: 177;
        readonly n22: 51;
    };
    readonly sn03: {
        readonly n21: 161;
        readonly n22: 51;
    };
    readonly sn04: {
        readonly n21: 129;
        readonly n22: 51;
    };
    readonly dr05: {
        readonly n21: 132;
        readonly n22: 55;
    };
    readonly tr01: {
        readonly n21: 81;
        readonly n22: 42;
    };
    readonly tr02: {
        readonly n21: 65;
        readonly n22: 43;
    };
    readonly hh01: {
        readonly n21: 129;
        readonly n22: 16;
    };
    readonly sn05: {
        readonly n21: 130;
        readonly n22: 35;
    };
    readonly sn06: {
        readonly n21: 130;
        readonly n22: 37;
    };
    readonly sn07: {
        readonly n21: 130;
        readonly n22: 38;
    };
    readonly hh02: {
        readonly n21: 161;
        readonly n22: 16;
    };
    readonly hh03: {
        readonly n21: 162;
        readonly n22: 17;
    };
    readonly sn08: {
        readonly n21: 162;
        readonly n22: 80;
    };
    readonly tr03: {
        readonly n21: 161;
        readonly n22: 24;
    };
    readonly tr04: {
        readonly n21: 145;
        readonly n22: 40;
    };
    readonly sn09: {
        readonly n21: 145;
        readonly n22: 34;
    };
    readonly sn10: {
        readonly n21: 113;
        readonly n22: 34;
    };
    readonly sn11: {
        readonly n21: 97;
        readonly n22: 34;
    };
    readonly dr20: {
        readonly n21: 17;
        readonly n22: 17;
    };
    readonly sn12: {
        readonly n21: 145;
        readonly n22: 51;
    };
    readonly sn13: {
        readonly n21: 81;
        readonly n22: 50;
    };
    readonly sn14: {
        readonly n21: 129;
        readonly n22: 49;
    };
    readonly ki01: {
        readonly n21: 128;
        readonly n22: 107;
    };
    readonly tr05: {
        readonly n21: 145;
        readonly n22: 24;
    };
    readonly dr27: {
        readonly n21: 146;
        readonly n22: 16;
    };
    readonly dr28: {
        readonly n21: 145;
        readonly n22: 0;
    };
    readonly dr29: {
        readonly n21: 145;
        readonly n22: 17;
    };
    readonly cr01: {
        readonly n21: 128;
        readonly n22: 21;
    };
    readonly dr31: {
        readonly n21: 81;
        readonly n22: 33;
    };
    readonly dr32: {
        readonly n21: 81;
        readonly n22: 80;
    };
    readonly dr33: {
        readonly n21: 161;
        readonly n22: 49;
    };
    readonly cr02: {
        readonly n21: 132;
        readonly n22: 18;
    };
    readonly dr35: {
        readonly n21: 129;
        readonly n22: 0;
    };
    readonly dr36: {
        readonly n21: 129;
        readonly n22: 33;
    };
    readonly ki02: {
        readonly n21: 160;
        readonly n22: 107;
    };
};
export type EngineAudioValueToken = keyof typeof AUDIO_DRUM_TOKEN_TO_VALUES;
export declare function audioRegisterTokenFromValue(register: number): EngineAudioRegisterToken | null;
export declare function audioValueTokenFromRegisterValue(register: number, value: number): EngineAudioValueToken | null;
export declare function resolveAudioRegister(register: EngineAudioRegisterToken): number;
export declare function resolveAudioValue(register: EngineAudioRegisterToken, value: number | EngineAudioValueToken): number;
