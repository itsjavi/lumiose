// Creature voices ("cries"), made the way handheld RPGs made them: a few base voices, each a short
// run of square and noise notes on two pulses and the noise channel, and every creature picks one
// and changes two numbers. `pitch` is added to each pulse note's frequency register (so low notes
// move further than high ones, which gives voices their character) and nudges the noise darker or
// brighter; `length` stretches the pulse notes like a tempo, while the noise keeps its own timing.
// The base voices, creatures and sprites here are original.
import { freqReg } from "../audio/driver.ts";
import { ns, p1, p2, rest } from "./sfx.ts";
import type { Sfx, SfxNote, SfxVoice } from "./types.ts";

export interface BaseVoice {
  id: string;
  name: string;
  hint: string;
  voices: SfxVoice[];
}

/** A duty cycle pattern byte: four duties that rotate every frame. */
const pat = (a: number, b: number, c: number, d: number) => (a << 6) | (b << 4) | (c << 2) | d;

/** The MIDI pitch of a pulse frequency register. */
export function regPitch(x: number): number {
  return 69 + 12 * Math.log2(131072 / (2048 - x) / 440);
}

/** Fade as the original drivers write it: 0 holds, 1-7 fades out (1 fastest), 9-15 fades in (9 fastest). */
const env = (fade: number) => (fade === 0 ? 0 : fade < 8 ? 8 - fade : fade - 16);

/**
 * A square note in the drivers' own terms: frames, volume, fade and a frequency register (not a
 * scale note), with an optional duty pattern and a per-frame slide of the register.
 */
function sqr(
  frames: number,
  volume: number,
  fade: number,
  reg: number,
  o: { pattern?: number; duty?: number; slide?: number } = {},
): SfxNote {
  return {
    frames,
    volume,
    env: env(fade),
    pitch: Math.round(regPitch(reg) * 1000) / 1000,
    duty: o.duty ?? 2,
    sweep: 0,
    noise: 0,
    ...(o.pattern === undefined ? {} : { pattern: o.pattern }),
    ...(o.slide ? { slide: o.slide } : {}),
  };
}

const hiss = (frames: number, volume: number, fade: number, poly: number): SfxNote => ({
  frames,
  volume,
  env: env(fade),
  pitch: 0,
  duty: 0,
  sweep: 0,
  noise: poly,
});

/**
 * Pulse 2 following pulse 1's contour: a few frames late, a few register units off and quieter,
 * often with its own duty pattern, so the pair beats like one rough voice instead of a harmony.
 */
function follow(
  notes: SfxNote[],
  o: { delay: number; offset: number; gain: number; pattern?: number },
): SfxNote[] {
  const shifted = notes.map((n): SfxNote => {
    if (n.volume === 0) return n;
    const x = Math.min(2047, Math.max(0, freqReg(n.pitch, false) + o.offset));
    return {
      ...n,
      pitch: Math.round(regPitch(x) * 1000) / 1000,
      volume: Math.max(1, Math.round(n.volume * o.gain)),
      ...(o.pattern === undefined ? {} : { pattern: o.pattern }),
    };
  });
  return o.delay > 0 ? [rest(o.delay), ...shifted] : shifted;
}

// Base voices. Each is one gesture: a contour of frequency registers that glides and wobbles, duty
// patterns for a voiced rasp, fading envelopes, a detuned second pulse and a layer of noise.

const squeak = [
  sqr(2, 13, 1, 1872, { pattern: pat(1, 1, 0, 0), slide: 18 }),
  sqr(3, 14, 2, 1914, { pattern: pat(1, 1, 0, 0), slide: 10 }),
  sqr(2, 9, 1, 1950, { pattern: pat(1, 1, 0, 0), slide: -26 }),
  rest(2),
  sqr(3, 12, 1, 1890, { pattern: pat(1, 0, 1, 0), slide: 22 }),
  sqr(7, 10, 3, 1946, { pattern: pat(1, 0, 1, 0), slide: -9 }),
];

const warble = [
  ...Array.from({ length: 8 }, (_, i) =>
    sqr(1, 12 - (i >> 2), 0, 1832 + (i % 2 ? 44 : 0) + i * 5, { pattern: pat(2, 1, 2, 1) }),
  ),
  sqr(9, 11, 2, 1898, { pattern: pat(2, 1, 2, 1), slide: -5 }),
];

const crackle = [
  sqr(3, 15, 1, 1690, { pattern: pat(3, 0, 3, 0), slide: 38 }),
  sqr(2, 12, 1, 1812, { pattern: pat(3, 0, 3, 0), slide: -22 }),
  sqr(4, 14, 2, 1752, { pattern: pat(0, 3, 3, 0), slide: 28 }),
  sqr(7, 10, 3, 1868, { pattern: pat(0, 3, 3, 0), slide: -14 }),
];

const moan = [
  sqr(12, 3, 11, 1598, { pattern: pat(2, 2, 2, 1), slide: 3 }),
  sqr(20, 11, 0, 1634, { pattern: pat(2, 2, 2, 1), slide: -2 }),
  sqr(14, 9, 3, 1594, { pattern: pat(2, 2, 1, 1), slide: -4 }),
];

const blub = [
  sqr(3, 11, 1, 1496, { pattern: pat(1, 1, 2, 2), slide: 34 }),
  rest(1),
  sqr(3, 10, 1, 1558, { pattern: pat(1, 1, 2, 2), slide: 34 }),
  rest(1),
  sqr(4, 12, 1, 1527, { pattern: pat(1, 1, 2, 2), slide: 29 }),
  rest(2),
  sqr(5, 9, 2, 1617, { pattern: pat(1, 2, 1, 2), slide: 24 }),
];

const servo = [
  sqr(4, 12, 0, 1700, { pattern: pat(3, 3, 0, 0) }),
  sqr(4, 12, 0, 1572, { pattern: pat(3, 3, 0, 0) }),
  sqr(4, 12, 0, 1700, { pattern: pat(3, 3, 0, 0) }),
  sqr(3, 12, 0, 1828, { pattern: pat(3, 3, 0, 0) }),
  sqr(8, 12, 2, 1572, { pattern: pat(3, 3, 0, 0), slide: -8 }),
];

const yawn = [
  sqr(8, 4, 10, 1502, { pattern: pat(1, 2, 1, 2), slide: 8 }),
  sqr(10, 12, 0, 1566, { pattern: pat(1, 2, 1, 2), slide: 2 }),
  sqr(16, 11, 5, 1586, { pattern: pat(2, 2, 1, 2), slide: -6 }),
];

const yip = [
  sqr(1, 15, 0, 1878, { duty: 3 }),
  sqr(1, 8, 0, 1870, { duty: 3 }),
  sqr(1, 15, 0, 1858, { duty: 3 }),
  sqr(1, 8, 0, 1848, { duty: 3 }),
  sqr(2, 14, 1, 1834, { pattern: pat(3, 2, 3, 2), slide: -20 }),
  sqr(3, 10, 2, 1782, { pattern: pat(3, 2, 3, 2), slide: -18 }),
  rest(3),
  sqr(1, 15, 0, 1898, { duty: 3 }),
  sqr(1, 8, 0, 1888, { duty: 3 }),
  sqr(1, 14, 0, 1876, { duty: 3 }),
  sqr(3, 12, 1, 1862, { pattern: pat(3, 2, 3, 2), slide: -24 }),
  sqr(5, 9, 2, 1782, { pattern: pat(3, 2, 3, 2), slide: -15 }),
];

const rumble = [
  sqr(10, 14, 0, 702, { pattern: pat(3, 3, 2, 2), slide: -4 }),
  sqr(14, 13, 0, 662, { pattern: pat(3, 3, 2, 2), slide: -3 }),
  sqr(20, 12, 3, 618, { pattern: pat(3, 2, 3, 2), slide: -2 }),
];

const glint = [
  ...Array.from({ length: 10 }, (_, i) => sqr(1, 10, 0, 1958 + (i % 2 ? 7 : 0), { duty: 0 })),
  sqr(12, 11, 0, 1944, { duty: 0, slide: 4 }),
  sqr(16, 8, 5, 1992, { duty: 0 }),
];

const flutter = [
  ...Array.from({ length: 10 }, (_, i) =>
    sqr(2, i % 2 ? 6 : 12, 0, 1778 + i * 4, { pattern: pat(2, 2, 1, 1) }),
  ),
  sqr(10, 10, 3, 1828, { pattern: pat(2, 2, 1, 1), slide: 4 }),
];

const roar = [
  sqr(4, 15, 0, 1198, { pattern: pat(3, 0, 3, 0), slide: 20 }),
  sqr(16, 15, 0, 1278, { pattern: pat(3, 0, 3, 0), slide: -6 }),
  sqr(20, 13, 3, 1182, { pattern: pat(3, 0, 0, 3), slide: -4 }),
];

const snore = [
  rest(26),
  sqr(18, 6, 0, 902, { pattern: pat(3, 3, 2, 2), slide: -3 }),
  sqr(10, 5, 2, 848, { pattern: pat(3, 2, 2, 2) }),
];

export const BASES: BaseVoice[] = [
  {
    id: "squeak",
    name: "Squeak",
    hint: "Two tiny upward squeaks",
    voices: [p1(...squeak), p2(...follow(squeak, { delay: 1, offset: -10, gain: 0.6 }))],
  },
  {
    id: "warble",
    name: "Warble",
    hint: "A frame-fast trill that settles",
    voices: [
      p1(...warble),
      p2(...follow(warble, { delay: 2, offset: -24, gain: 0.5, pattern: pat(1, 2, 1, 2) })),
      ns(hiss(2, 4, 1, 0x10), rest(2), hiss(2, 3, 1, 0x11)),
    ],
  },
  {
    id: "crackle",
    name: "Crackle",
    hint: "Buzzing jumps over sparking noise",
    voices: [
      p1(...crackle),
      p2(...follow(crackle, { delay: 0, offset: 6, gain: 0.45, pattern: pat(0, 3, 0, 3) })),
      ns(
        hiss(1, 13, 1, 0x01),
        rest(1),
        hiss(1, 12, 1, 0x02),
        rest(2),
        hiss(1, 14, 1, 0x00),
        rest(1),
        hiss(6, 10, 2, 0x11),
      ),
    ],
  },
  {
    id: "moan",
    name: "Moan",
    hint: "Swells in and sags, two pulses beating",
    voices: [
      p1(...moan),
      p2(...follow(moan, { delay: 3, offset: -5, gain: 0.7 })),
      ns(hiss(12, 2, 11, 0x34), hiss(24, 6, 3, 0x35)),
    ],
  },
  {
    id: "blub",
    name: "Blub",
    hint: "Bubbles that rise and pop",
    voices: [
      p1(...blub),
      p2(...follow(blub, { delay: 2, offset: -30, gain: 0.5 })),
      ns(hiss(3, 3, 1, 0x26), rest(5), hiss(4, 2, 1, 0x27)),
    ],
  },
  {
    id: "servo",
    name: "Servo",
    hint: "Grinding steps and ticks",
    voices: [
      p1(...servo),
      p2(...follow(servo, { delay: 0, offset: 3, gain: 0.6, pattern: pat(0, 0, 3, 3) })),
      ns(
        ...Array.from({ length: 5 }, () => [hiss(1, 9, 1, 0x00), rest(3)]).flat(),
        hiss(2, 6, 1, 0x22),
      ),
    ],
  },
  {
    id: "yawn",
    name: "Yawn",
    hint: "A slow rise, a sigh and a breath",
    voices: [
      p1(...yawn),
      p2(...follow(yawn, { delay: 4, offset: -8, gain: 0.6 })),
      ns(hiss(20, 3, 12, 0x45)),
    ],
  },
  {
    id: "yip",
    name: "Yip",
    hint: "Two raspy barks that drop",
    voices: [
      p1(...yip),
      p2(...follow(yip, { delay: 0, offset: -40, gain: 0.6, pattern: pat(2, 2, 2, 2) })),
      ns(hiss(2, 10, 1, 0x23), rest(13), hiss(2, 9, 1, 0x23)),
    ],
  },
  {
    id: "rumble",
    name: "Rumble",
    hint: "Very low, slow and heavy",
    voices: [
      p1(...rumble),
      p2(...follow(rumble, { delay: 0, offset: -24, gain: 0.8, pattern: pat(2, 3, 2, 3) })),
      ns(hiss(6, 12, 1, 0x56), hiss(30, 9, 4, 0x67)),
    ],
  },
  {
    id: "glint",
    name: "Glint",
    hint: "A glassy shiver with a metal ring",
    voices: [
      p1(...glint),
      p2(...follow(glint, { delay: 6, offset: 4, gain: 0.5 })),
      ns(hiss(4, 7, 1, 0x18), hiss(26, 5, 4, 0x19)),
    ],
  },
  {
    id: "flutter",
    name: "Flutter",
    hint: "Wing-beat tremolo, drifting up",
    voices: [
      p1(...flutter),
      p2(...follow(flutter, { delay: 1, offset: -14, gain: 0.5 })),
      ns(...Array.from({ length: 5 }, () => [hiss(2, 4, 1, 0x14), rest(2)]).flat()),
    ],
  },
  {
    id: "roar",
    name: "Roar",
    hint: "A rough bellow over a long crash",
    voices: [
      p1(...roar),
      p2(...follow(roar, { delay: 1, offset: -40, gain: 0.9, pattern: pat(0, 3, 0, 3) })),
      ns(hiss(3, 15, 1, 0x31), hiss(40, 13, 5, 0x44)),
    ],
  },
  {
    id: "snore",
    name: "Snore",
    hint: "Breathe in, grumble, breathe out",
    voices: [
      p1(...snore),
      p2(...follow(snore, { delay: 1, offset: -10, gain: 0.7 })),
      ns(hiss(24, 1, 13, 0x46), rest(6), hiss(30, 9, 4, 0x57)),
    ],
  },
];

export interface Creature {
  id: string;
  name: string;
  blurb: string;
  base: string;
  /** Frequency register offset, as in the original drivers (-256…256). */
  pitch: number;
  /** Tempo of the pulse notes: 1 as written, 2 twice as long. */
  length: number;
  /** 12×12 sprite: "." clear, "a"/"b"/"c" light to dark. */
  sprite: string[];
}

export const CREATURES: Creature[] = [
  {
    id: "pipsqueak",
    name: "Pipsqueak",
    blurb: "A puffball that squeaks when it is happy, which is always.",
    base: "squeak",
    pitch: 0,
    length: 1,
    sprite: [
      "..c......c..",
      ".cac....cac.",
      ".caaccccaac.",
      "..caaaaaac..",
      ".caaaaaaaac.",
      ".cacaaaacac.",
      ".caaabbaaac.",
      ".cbaaaaaabc.",
      "..caaaaaac..",
      "...cccccc...",
      "..cb....bc..",
      "............",
    ],
  },
  {
    id: "chirrup",
    name: "Chirrup",
    blurb: "A songbird that answers every whistle.",
    base: "warble",
    pitch: 0,
    length: 1,
    sprite: [
      "............",
      "....ccc.....",
      "...caaac....",
      "..cacaaac...",
      "ccbaaaaac...",
      "..caaaaaacc.",
      "..cabbbbaac.",
      "...cabbbac..",
      "....caaac...",
      ".....cbc....",
      ".....c.c....",
      "....cc.cc...",
    ],
  },
  {
    id: "zapling",
    name: "Zapling",
    blurb: "A static spark that hides in old radios.",
    base: "crackle",
    pitch: 0,
    length: 0.9,
    sprite: [
      ".....c......",
      "....cac.....",
      "...cac......",
      "..caacccc...",
      ".caaaaaaac..",
      ".cacaaacac..",
      ".caaaaaaac..",
      "..caabbac...",
      "...ccaacc...",
      ".....cac....",
      "....cac.....",
      "....cc......",
    ],
  },
  {
    id: "wispet",
    name: "Wispet",
    blurb: "A shy ghost. Its wail is mostly a yawn.",
    base: "moan",
    pitch: 0,
    length: 1,
    sprite: [
      "....cccc....",
      "...caaaac...",
      "..caaaaaac..",
      ".caaaaaaaac.",
      ".cacc..ccac.",
      ".caaaaaaaac.",
      ".caaabbaaac.",
      ".caaaaaaaac.",
      ".caaaaaaaac.",
      ".cacaacaacc.",
      ".c.cc.cc.c..",
      "............",
    ],
  },
  {
    id: "bubbloon",
    name: "Bubbloon",
    blurb: "A round fish that talks in bubbles.",
    base: "blub",
    pitch: 0,
    length: 1,
    sprite: [
      "..........a.",
      "....cccc.a.a",
      "..ccaaaac.a.",
      ".caaaaaaac..",
      "caacaaaaacc.",
      "caaaaaaaacac",
      "cbaaaaaaacac",
      ".cbbaaaaacc.",
      "..cbbbbbc...",
      "...ccccc....",
      "............",
      "............",
    ],
  },
  {
    id: "gearbot",
    name: "Gearbot",
    blurb: "A tin helper that beeps in squares.",
    base: "servo",
    pitch: 0,
    length: 1,
    sprite: [
      ".....c......",
      ".....c......",
      "..cccccccc..",
      "..caaaaaac..",
      "..cacbbcac..",
      "..caaaaaac..",
      "..caccccac..",
      "...cccccc...",
      ".cccaaaaccc.",
      ".c.caaaac.c.",
      "...cc..cc...",
      "............",
    ],
  },
  {
    id: "mossling",
    name: "Mossling",
    blurb: "A sleepy sprout with a slow, low chirp.",
    base: "yawn",
    pitch: 0,
    length: 1.25,
    sprite: [
      "....b..b....",
      "...bab.bab..",
      "....bbcbb...",
      "......c.....",
      "...cccccc...",
      "..caaaaaac..",
      ".caccaacc.c.",
      ".caaaaaaaac.",
      ".caaabbaaac.",
      "..caaaaaac..",
      "...cccccc...",
      "............",
    ],
  },
  {
    id: "emberkit",
    name: "Emberkit",
    blurb: "A fox kit with a warm, tiny growl.",
    base: "yip",
    pitch: 24,
    length: 0.9,
    sprite: [
      ".c.......c..",
      ".cc.....cc..",
      ".cac...cac..",
      ".caaccccac..",
      ".caaaaaaac..",
      ".cacaaacac..",
      "..caabaac...",
      "...caaac..bb",
      "..caaaaacbab",
      "..caaaaaacbb",
      "..cc.c.cc...",
      "............",
    ],
  },
  {
    id: "boulderback",
    name: "Boulderback",
    blurb: "A tortoise with a hill on its back and a voice to match.",
    base: "rumble",
    pitch: 0,
    length: 1.2,
    sprite: [
      "............",
      "....cccc....",
      "..ccbbbbcc..",
      ".cbbcbbcbbc.",
      ".cbbbbbbbbc.",
      "cccccccccccc",
      "caac.....cac",
      "cacc.....ccc",
      "caac........",
      ".cc.cc..cc..",
      "....cc..cc..",
      "............",
    ],
  },
  {
    id: "glaciore",
    name: "Glaciore",
    blurb: "An ice spirit whose wail echoes in caves.",
    base: "glint",
    pitch: -32,
    length: 1.1,
    sprite: [
      ".....c......",
      "....cac.....",
      "...caaac....",
      "..caaaaac...",
      ".caaaaaaac..",
      "caccaaaccac.",
      "caaaaaaaaac.",
      ".caaabaaac..",
      "..caaaaac...",
      "...caaac....",
      "....cac.....",
      ".....c......",
    ],
  },
  {
    id: "lumoth",
    name: "Lumoth",
    blurb: "A moth that sings to streetlamps at night.",
    base: "flutter",
    pitch: 0,
    length: 1,
    sprite: [
      "............",
      "..c......c..",
      "...c....c...",
      "bb..cccc..bb",
      "baba.cc.abab",
      "baaab..baaab",
      "baaaacccaaab",
      ".baaacccaab.",
      "..bba.c.abb.",
      "......c.....",
      "......c.....",
      "............",
    ],
  },
  {
    id: "stormaw",
    name: "Stormaw",
    blurb: "A thunder beast. Its crackle rolls on long after it stops.",
    base: "roar",
    pitch: 0,
    length: 1.1,
    sprite: [
      "c..........c",
      "cc..cccc..cc",
      ".cccaaaaccc.",
      "..caaaaaac..",
      ".caccaaccac.",
      ".caaaaaaac..",
      ".cabcbcbac..",
      ".caaaaaaac..",
      "..caaaaac...",
      ".ccaccccacc.",
      ".c.cc..cc.c.",
      "............",
    ],
  },
  {
    id: "snoozle",
    name: "Snoozle",
    blurb: "It only ever talks in its sleep.",
    base: "snore",
    pitch: 0,
    length: 1,
    sprite: [
      "........bbb.",
      ".........b..",
      "........bbb.",
      "...cccccc...",
      "..caaaaaac..",
      ".caaaaaaaac.",
      ".cabbaabbac.",
      ".caaaaaaaac.",
      ".caaaccaaac.",
      "..caaaaaac..",
      "...cccccc...",
      "............",
    ],
  },
];

export const baseById = (id: string): BaseVoice => BASES.find((b) => b.id === id) ?? BASES[0]!;
export const creatureById = (id: string): Creature | undefined =>
  CREATURES.find((c) => c.id === id);

/** A base voice with a creature's pitch and length, as an SFX the driver can play. */
export function voiceSfx(base: BaseVoice, pitch: number, length: number, name = base.name): Sfx {
  return {
    id: `voice-${base.id}`,
    name,
    blurb: base.hint,
    voices: base.voices.map((voice) => ({
      ...voice,
      notes: voice.notes.map((n): SfxNote => {
        if (voice.channel === 3) {
          // Noise keeps its own timing; pitch shifts its clock (higher pitch, brighter hiss).
          const s = Math.min(13, Math.max(0, (n.noise >> 4) - Math.round(pitch / 64)));
          return { ...n, noise: (s << 4) | (n.noise & 0x0f) };
        }
        const frames = Math.max(1, Math.round(n.frames * length));
        if (n.volume === 0) return { ...n, frames };
        // Slides keep the contour's shape when the voice is stretched.
        const slide = n.slide ? Math.round(n.slide / length) || Math.sign(n.slide) : undefined;
        const x = Math.min(2047, Math.max(0, freqReg(n.pitch, false) + Math.round(pitch)));
        return {
          ...n,
          frames,
          pitch: Math.round(regPitch(x) * 1000) / 1000,
          ...(slide ? { slide } : {}),
        };
      }),
    })),
  };
}

export const creatureSfx = (c: Creature): Sfx => ({
  ...voiceSfx(baseById(c.base), c.pitch, c.length, c.name),
  id: c.id,
});

const hex = (n: number, d: number) =>
  `$${(n & (16 ** d - 1)).toString(16).toUpperCase().padStart(d, "0")}`;

/** The voice's header line, in the original drivers' terms. */
export function cryHeader(base: BaseVoice, pitch: number, length: number): string {
  return `; base voice "${base.name}", pitch ${hex(Math.round(pitch), 4)}, length ${hex(Math.round(length * 256), 4)}`;
}
