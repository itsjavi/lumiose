// A tiny text notation for authoring the demo songs (and tests):
//
//   melody("C5:4 E5:2 G5:6 .:4 | A5:8 _:8")   notes with lengths in 16th steps
//
// `.` is a rest, `_` extends the previous note, a missing `:len` reuses the last length, and `|`
// checks that a bar (16 steps) just ended. Drums use letters: K kick, S snare, H hi-hat,
// O open hat, X shaker, T high tom, L low tom, C crash; `K+H:2` hits two at once (the first wins
// on the one noise channel, so it is mostly for readability). Chord helpers expand chord symbols
// into notes, such as `chords("F Am Bb C", "1:2 5:2 3:2 5:2", 3)`.
import { DRUM } from "./instruments.ts";
import { noteName, parseNote } from "./music.ts";
import { STEPS_PER_BAR, type Note } from "./types.ts";

function walk(src: string, onToken: (token: string, at: number, len: number) => void): number {
  let at = 0;
  let len = 4;
  for (const token of src.split(/\s+/).filter(Boolean)) {
    if (token === "|") {
      if (at % STEPS_PER_BAR !== 0)
        throw new Error(`Bar line at step ${at}: "${src.slice(0, 60)}…"`);
      continue;
    }
    const [name, size] = token.split(":");
    if (size !== undefined) len = Number(size);
    if (!Number.isInteger(len) || len <= 0) throw new Error(`Bad length in "${token}"`);
    onToken(name!, at, len);
    at += len;
  }
  return at;
}

export function melody(src: string): Note[] {
  const notes: Note[] = [];
  walk(src, (name, at, len) => {
    if (name === ".") return;
    if (name === "_") {
      const last = notes.at(-1);
      if (!last || last.s + last.l !== at) throw new Error(`Nothing to extend at step ${at}`);
      last.l += len;
      return;
    }
    notes.push({ s: at, l: len, p: parseNote(name) });
  });
  return notes;
}

const DRUM_LETTERS: Record<string, number> = {
  K: DRUM.kick,
  S: DRUM.snare,
  H: DRUM.hat,
  O: DRUM.openHat,
  X: DRUM.shaker,
  T: DRUM.highTom,
  L: DRUM.lowTom,
  C: DRUM.crash,
};

export function drums(src: string): Note[] {
  const notes: Note[] = [];
  walk(src, (name, at) => {
    if (name === ".") return;
    const first = name.split("+")[0]!;
    const p = DRUM_LETTERS[first];
    if (p === undefined) throw new Error(`Unknown drum "${name}"`);
    notes.push({ s: at, l: 1, p });
  });
  return notes;
}

/** Steps covered by a notation string (for tests). */
export function length(src: string): number {
  return walk(src, () => {});
}

const QUALITIES: [RegExp, number[]][] = [
  [/maj7$/, [0, 4, 7, 11]],
  [/m7$/, [0, 3, 7, 10]],
  [/7$/, [0, 4, 7, 10]],
  [/sus$/, [0, 5, 7, 12]],
  [/dim$/, [0, 3, 6, 12]],
  [/m$/, [0, 3, 7, 12]],
  [/$/, [0, 4, 7, 12]],
];

/** Chord tones from a symbol such as "F", "Am", "Bb", "E7", "Cmaj7", "Dsus", in an octave. */
export function chordTones(symbol: string, octave: number): number[] {
  const match = /^([A-G][#b]?)(.*)$/.exec(symbol);
  if (!match) throw new Error(`Not a chord: ${symbol}`);
  const root = parseNote(`${match[1]}${octave}`);
  const [, intervals] = QUALITIES.find(([re]) => re.test(match[2]!))!;
  return intervals.map((i) => root + i);
}

/**
 * One bar per chord symbol, each played with `pattern`: tokens of chord degrees (1 root, 3 third,
 * 5 fifth, 7 seventh or octave), `'` for an octave up, `,` for an octave down, `.` rests and `_`
 * ties, with lengths as in `melody`. Returns notation.
 */
export function chords(symbols: string, pattern: string, octave: number): string {
  return symbols
    .split(/\s+/)
    .filter(Boolean)
    .map((symbol) => {
      const tones = chordTones(symbol, octave);
      const bar = pattern
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => {
          const [degree, size] = token.split(":");
          const suffix = size === undefined ? "" : `:${size}`;
          if (degree === "." || degree === "_") return `${degree}${suffix}`;
          const base = { "1": 0, "3": 1, "5": 2, "7": 3 }[degree!.replace(/[',]/g, "")[0] as "1"];
          if (base === undefined) throw new Error(`Bad degree "${token}"`);
          const shift = [...degree!].reduce(
            (sum, c) => sum + (c === "'" ? 12 : c === "," ? -12 : 0),
            0,
          );
          return `${noteName(tones[base]! + shift)}${suffix}`;
        })
        .join(" ");
      return `${bar} |`;
    })
    .join(" ");
}

/** Repeats a notation string. */
export const repeat = (src: string, times: number): string =>
  Array.from({ length: times }, () => src).join(" ");

/** Shifts notes later by `steps` (an echo), dropping what falls past `total`. */
export function delay(notes: readonly Note[], steps: number, total: number): Note[] {
  return notes
    .map((n) => ({ ...n, s: n.s + steps }))
    .filter((n) => n.s < total)
    .map((n) => ({ ...n, l: Math.min(n.l, total - n.s) }));
}

/** Shifts notes by `steps` (to place a phrase after an intro). */
export const offset = (notes: readonly Note[], steps: number): Note[] =>
  notes.map((n) => ({ ...n, s: n.s + steps }));

const pitchClass = (p: number) => ((p % 12) + 12) % 12;

/**
 * A harmony line a diatonic third below a melody: each note moves down to the note three or four
 * semitones lower that belongs to the scale (`key` 0–11 and the scale's semitone steps). With a
 * bass line, a note a minor second, tritone or major seventh away from the bass note under it gives
 * way to the other third, or a fourth or sixth below.
 */
export function thirdsBelow(
  notes: readonly Note[],
  key: number,
  steps: readonly number[],
  bass: readonly Note[] = [],
): Note[] {
  const inScale = (p: number) => steps.includes(pitchClass(p - key));
  return notes.map((n) => {
    const under = bass.find((b) => b.s <= n.s && n.s < b.s + b.l);
    const harsh = (p: number) => !!under && [1, 6, 11].includes(pitchClass(p - under.p));
    // A third below; when both thirds grate on the bass, a fourth or a sixth below instead.
    const options = [n.p - 3, n.p - 4, n.p - 5, n.p - 8, n.p - 9].filter(inScale);
    const p = options.find((o) => !harsh(o)) ?? options[0] ?? n.p - 3;
    return { ...n, p };
  });
}
