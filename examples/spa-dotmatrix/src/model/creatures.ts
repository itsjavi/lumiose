// Creature voices ("cries"), made the way handheld RPGs made them: a few base voices, each a short
// run of square and noise notes on two pulses and the noise channel, and every creature picks one
// and changes two numbers. `pitch` is added to each pulse note's frequency register (so low notes
// move further than high ones, which gives voices their character) and nudges the noise darker or
// brighter; `length` stretches the pulse notes like a tempo, while the noise keeps its own timing.
// The base voices, creatures and sprites here are original.
import { freqReg } from "../audio/driver.ts";
import { ns, nz, p1, p2, rest, sq } from "./sfx.ts";
import type { Sfx, SfxNote, SfxVoice } from "./types.ts";

export interface BaseVoice {
  id: string;
  name: string;
  hint: string;
  voices: SfxVoice[];
}

/** A pulse-2 copy of a run of notes, slightly detuned and quieter: two pulses beating together. */
function shadow(notes: SfxNote[], detune: number, gain: number, duty = 1): SfxNote[] {
  return notes.map((n) => ({
    ...n,
    pitch: n.pitch + detune,
    duty,
    volume: n.volume === 0 ? 0 : Math.max(1, Math.round(n.volume * gain)),
  }));
}

const chirp = [
  sq(3, 12, 0, "E6", 2),
  sq(4, 12, 0, "G6", 2),
  sq(3, 10, 0, "E6", 2),
  sq(12, 11, 3, "B5", 2),
];
const trill = [
  ...Array.from({ length: 5 }, () => [sq(2, 11, 0, "A6", 1), sq(2, 11, 0, "C#7", 1)]).flat(),
  sq(10, 10, 4, "E6", 1),
];
const growl = [sq(6, 15, 0, "C3", 3), sq(10, 14, 0, "B2", 3), sq(18, 13, 2, "A2", 3)];
const zap = [
  ...Array.from({ length: 3 }, () => [sq(2, 12, 0, "C7", 0), sq(2, 12, 0, "F#6", 0)]).flat(),
  sq(14, 12, 4, "C6", 0, -3),
];
const wail = [
  sq(10, 3, -6, "E5", 2),
  sq(10, 10, 0, "F5", 2),
  sq(14, 10, 0, "E5", 2),
  sq(22, 10, 3, "D#5", 2),
];
const bubble = [
  sq(3, 11, 2, "C5", 1),
  sq(3, 11, 2, "E5", 1),
  sq(3, 9, 2, "G5", 1),
  rest(2),
  sq(3, 9, 2, "C6", 1),
  sq(12, 9, 4, "A5", 1),
];
const beep = [
  sq(4, 12, 0, "C5", 2),
  sq(4, 12, 0, "C6", 2),
  sq(4, 12, 0, "G5", 2),
  sq(4, 12, 0, "C6", 2),
  sq(10, 12, 3, "C5", 2),
];

export const BASES: BaseVoice[] = [
  {
    id: "chirp",
    name: "Chirp",
    hint: "Small and bright",
    voices: [p1(...chirp), p2(rest(1), ...shadow(chirp, 0.2, 0.6))],
  },
  {
    id: "trill",
    name: "Trill",
    hint: "A fluttering bird call",
    voices: [p1(...trill), p2(rest(3), ...shadow(trill, -12, 0.5))],
  },
  {
    id: "growl",
    name: "Growl",
    hint: "Low 75% squares and rumbling noise",
    voices: [
      p1(...growl),
      p2(...shadow(growl, 0.35, 0.8, 2)),
      ns(nz(4, 10, 1, 5, 4), nz(24, 7, 3, 6, 6)),
    ],
  },
  {
    id: "zap",
    name: "Zap",
    hint: "Crackling 12.5% blips with a falling sweep",
    voices: [
      p1(...zap),
      ns(nz(2, 12, 1, 0, 1), rest(2), nz(2, 11, 1, 0, 2), rest(2), nz(8, 10, 2, 1, 1)),
    ],
  },
  {
    id: "wail",
    name: "Wail",
    hint: "Swells in, two pulses beating",
    voices: [p1(...wail), p2(...shadow(wail, 0.45, 0.5, 2))],
  },
  {
    id: "bubble",
    name: "Bubble",
    hint: "Rising blips with a soft hiss",
    voices: [p1(...bubble), p2(rest(2), ...shadow(bubble, 5, 0.55)), ns(nz(6, 4, 1, 3, 3))],
  },
  {
    id: "beep",
    name: "Beep",
    hint: "Square steps and ticking noise",
    voices: [
      p1(...beep),
      p2(...shadow(beep, -12, 0.6, 0)),
      ns(...Array.from({ length: 4 }, () => [nz(1, 8, 0, 0, 0), rest(3)]).flat()),
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
    base: "chirp",
    pitch: 16,
    length: 0.8,
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
    base: "trill",
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
    base: "zap",
    pitch: 32,
    length: 1,
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
    base: "wail",
    pitch: 0,
    length: 1.2,
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
    base: "bubble",
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
    base: "beep",
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
    base: "chirp",
    pitch: -96,
    length: 1.4,
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
    base: "growl",
    pitch: 224,
    length: 0.7,
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
    base: "growl",
    pitch: -40,
    length: 1.5,
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
    base: "wail",
    pitch: -64,
    length: 1.6,
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
    base: "trill",
    pitch: -128,
    length: 1.3,
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
    base: "zap",
    pitch: -160,
    length: 1.6,
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
    base: "wail",
    pitch: 40,
    length: 2,
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

/** The MIDI pitch of a pulse frequency register. */
function regPitch(x: number): number {
  const freq = 131072 / (2048 - x);
  return 69 + 12 * Math.log2(freq / 440);
}

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
        const x = Math.min(2047, Math.max(0, freqReg(n.pitch, false) + Math.round(pitch)));
        return { ...n, frames, pitch: Math.round(regPitch(x) * 1000) / 1000 };
      }),
    })),
  };
}

export const creatureSfx = (c: Creature): Sfx => ({
  ...voiceSfx(baseById(c.base), c.pitch, c.length, c.name),
  id: c.id,
});

/** The voice's header line, in the original drivers' terms. */
export function cryHeader(base: BaseVoice, pitch: number, length: number): string {
  const hex = (n: number, d: number) =>
    `$${(n & (16 ** d - 1)).toString(16).toUpperCase().padStart(d, "0")}`;
  return `; base voice "${base.name}", pitch ${hex(Math.round(pitch), 4)}, length ${hex(Math.round(length * 256), 4)}`;
}
