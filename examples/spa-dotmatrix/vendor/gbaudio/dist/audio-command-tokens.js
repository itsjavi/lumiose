/**
 * Human-readable register tokens used in authored/generated audio command streams.
 * Tokens follow original GB register names in lowercase:
 * - `n10`..`n52` => NR10..NR52
 * - `w30`..`w3f` => wave RAM addresses $30..$3F
 */
export const AUDIO_REGISTER_TOKEN_TO_VALUE = {
    n10: 0x10,
    n11: 0x11,
    n12: 0x12,
    n13: 0x13,
    n14: 0x14,
    n16: 0x16,
    n17: 0x17,
    n18: 0x18,
    n19: 0x19,
    n1a: 0x1a,
    n1b: 0x1b,
    n1c: 0x1c,
    n1d: 0x1d,
    n1e: 0x1e,
    n20: 0x20,
    n21: 0x21,
    n22: 0x22,
    n23: 0x23,
    n24: 0x24,
    n25: 0x25,
    n26: 0x26,
    w30: 0x30,
    w31: 0x31,
    w32: 0x32,
    w33: 0x33,
    w34: 0x34,
    w35: 0x35,
    w36: 0x36,
    w37: 0x37,
    w38: 0x38,
    w39: 0x39,
    w3a: 0x3a,
    w3b: 0x3b,
    w3c: 0x3c,
    w3d: 0x3d,
    w3e: 0x3e,
    w3f: 0x3f,
};
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
export const AUDIO_DRUM_TOKEN_TO_VALUES = {
    dr00: { n21: 0x11, n22: 0x00 },
    sn01: { n21: 0xc1, n22: 0x33 },
    sn02: { n21: 0xb1, n22: 0x33 },
    sn03: { n21: 0xa1, n22: 0x33 },
    sn04: { n21: 0x81, n22: 0x33 },
    dr05: { n21: 0x84, n22: 0x37 },
    tr01: { n21: 0x51, n22: 0x2a },
    tr02: { n21: 0x41, n22: 0x2b },
    hh01: { n21: 0x81, n22: 0x10 },
    sn05: { n21: 0x82, n22: 0x23 },
    sn06: { n21: 0x82, n22: 0x25 },
    sn07: { n21: 0x82, n22: 0x26 },
    hh02: { n21: 0xa1, n22: 0x10 },
    hh03: { n21: 0xa2, n22: 0x11 },
    sn08: { n21: 0xa2, n22: 0x50 },
    tr03: { n21: 0xa1, n22: 0x18 },
    tr04: { n21: 0x91, n22: 0x28 },
    sn09: { n21: 0x91, n22: 0x22 },
    sn10: { n21: 0x71, n22: 0x22 },
    sn11: { n21: 0x61, n22: 0x22 },
    dr20: { n21: 0x11, n22: 0x11 },
    sn12: { n21: 0x91, n22: 0x33 },
    sn13: { n21: 0x51, n22: 0x32 },
    sn14: { n21: 0x81, n22: 0x31 },
    ki01: { n21: 0x80, n22: 0x6b },
    tr05: { n21: 0x91, n22: 0x18 },
    dr27: { n21: 0x92, n22: 0x10 },
    dr28: { n21: 0x91, n22: 0x00 },
    dr29: { n21: 0x91, n22: 0x11 },
    cr01: { n21: 0x80, n22: 0x15 },
    dr31: { n21: 0x51, n22: 0x21 },
    dr32: { n21: 0x51, n22: 0x50 },
    dr33: { n21: 0xa1, n22: 0x31 },
    cr02: { n21: 0x84, n22: 0x12 },
    dr35: { n21: 0x81, n22: 0x00 },
    dr36: { n21: 0x81, n22: 0x21 },
    ki02: { n21: 0xa0, n22: 0x6b },
};
const AUDIO_REGISTER_VALUE_TO_TOKEN = Object.entries(AUDIO_REGISTER_TOKEN_TO_VALUE).reduce((acc, [token, value]) => {
    acc[value] = token;
    return acc;
}, {});
function buildUniqueReverseMap(register) {
    const firstMatch = new Map();
    const duplicates = new Set();
    for (const [token, values] of Object.entries(AUDIO_DRUM_TOKEN_TO_VALUES)) {
        const value = values[register];
        if (firstMatch.has(value)) {
            duplicates.add(value);
            continue;
        }
        firstMatch.set(value, token);
    }
    const out = {};
    for (const [value, token] of firstMatch.entries()) {
        if (!duplicates.has(value)) {
            out[value] = token;
        }
    }
    return out;
}
const AUDIO_VALUE_TOKEN_BY_N21 = buildUniqueReverseMap('n21');
const AUDIO_VALUE_TOKEN_BY_N22 = buildUniqueReverseMap('n22');
export function audioRegisterTokenFromValue(register) {
    return AUDIO_REGISTER_VALUE_TO_TOKEN[register] ?? null;
}
export function audioValueTokenFromRegisterValue(register, value) {
    if (register === AUDIO_REGISTER_TOKEN_TO_VALUE.n21) {
        return AUDIO_VALUE_TOKEN_BY_N21[value] ?? null;
    }
    if (register === AUDIO_REGISTER_TOKEN_TO_VALUE.n22) {
        return AUDIO_VALUE_TOKEN_BY_N22[value] ?? null;
    }
    return null;
}
export function resolveAudioRegister(register) {
    return AUDIO_REGISTER_TOKEN_TO_VALUE[register];
}
export function resolveAudioValue(register, value) {
    if (typeof value === 'number') {
        return value & 0xff;
    }
    const resolvedRegister = resolveAudioRegister(register);
    const drum = AUDIO_DRUM_TOKEN_TO_VALUES[value];
    if (!drum) {
        throw new Error(`Unknown audio value token: ${String(value)}`);
    }
    if (resolvedRegister === AUDIO_REGISTER_TOKEN_TO_VALUE.n21) {
        return drum.n21;
    }
    if (resolvedRegister === AUDIO_REGISTER_TOKEN_TO_VALUE.n22) {
        return drum.n22;
    }
    throw new Error(`Audio value token "${value}" is only valid for n21 or n22 writes`);
}
