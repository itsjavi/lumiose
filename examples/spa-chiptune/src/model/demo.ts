// "Lumen Quest": the bundled demo song. A minor, Am-F-C-G, 150 BPM at speed 6 (60 ticks/s).
import { defaultMixer, emptyPattern, instrument, macro } from "./song.ts";
import { NOTE_OFF, type Cell, type Pattern, type Song } from "./types.ts";

const NAMES = ["C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-"];

/** "A-4" → 57, "C#5" → 61. */
export function parseNote(name: string): number {
  const index = NAMES.indexOf(name.slice(0, 2));
  if (index < 0) throw new Error(`Bad note ${name}`);
  return index + 12 * Number(name.slice(2));
}

const P1 = 0;
const P2 = 1;
const TRI = 2;
const NOI = 3;

const LEAD = 0;
const CHORD = 1;
const BASS = 2;
const KICK = 3;
const SNARE = 4;
const HAT = 5;
const ECHO = 6;
const CRASH = 7;

function put(p: Pattern, row: number, ch: number, cell: Partial<Cell>): void {
  Object.assign(p.rows[row]![ch]!, cell);
}

/** Notes as [row, note, length]; an OFF follows a note when the next one starts later. */
function melody(p: Pattern, ch: number, inst: number, notes: [number, string, number][], vol = -1) {
  notes.forEach(([row, name, length], i) => {
    put(p, row, ch, { note: parseNote(name), inst, vol });
    const end = row + length;
    const next = notes[i + 1]?.[0] ?? p.rows.length;
    if (end < next && end < p.rows.length) put(p, end, ch, { note: NOTE_OFF });
  });
}

const BARS = [
  { root: "A-", minor: true },
  { root: "F-", minor: false },
  { root: "C-", minor: false },
  { root: "G-", minor: false },
];

/** Driving eighth-note triangle bass: root, octave, root, octave… with a fifth near the end. */
function bass(p: Pattern, half = false) {
  BARS.forEach((bar, b) => {
    const octave = bar.root === "C-" ? 3 : 2;
    const root = parseNote(`${bar.root}${octave}`);
    const steps = half ? [0, 12, 0, 7] : [0, 12, 0, 12, 0, 12, 7, 12];
    const every = half ? 4 : 2;
    steps.forEach((offset, i) =>
      put(p, b * 16 + i * every, TRI, { note: root + offset, inst: BASS }),
    );
  });
}

/** Arpeggiated chords on pulse 2 in a 3-3-2 rhythm (0xy: 037 minor, 047 major). */
function chords(p: Pattern, hits = [0, 3, 6, 8, 11, 14], vol = -1) {
  BARS.forEach((bar, b) => {
    const octave = bar.root === "C-" ? 4 : 3;
    hits.forEach((hit) =>
      put(p, b * 16 + hit, P2, {
        note: parseNote(`${bar.root}${octave}`),
        inst: CHORD,
        vol,
        fx: "0",
        param: bar.minor ? 0x37 : 0x47,
      }),
    );
  });
}

// The volume column persists per channel, so every hit sets its own.
const DRUM: Record<string, Partial<Cell>> = {
  k: { note: 5, inst: KICK, vol: 15 },
  s: { note: 9, inst: SNARE, vol: 14 },
  h: { note: 13, inst: HAT, vol: 15 },
  o: { note: 12, inst: CRASH, vol: 7 },
  c: { note: 11, inst: CRASH, vol: 15 },
};

/** One character per row: k kick, s snare, h hat, o open hat, c crash, "." rest. */
function drums(p: Pattern, bars: string[]) {
  bars.forEach((bar, b) =>
    [...bar].forEach((ch, i) => {
      const cell = DRUM[ch];
      if (cell) put(p, b * 16 + i, NOI, cell);
    }),
  );
}

const BEAT = "k.h.s.h.k.hks.h.";
const BEAT_B = "k.h.s.hkk.h.s.ho";

export function demoSong(): Song {
  const length = 64;
  const patterns = Array.from({ length: 4 }, () => emptyPattern(length));
  const [intro, verse, answer, bridge] = patterns as [Pattern, Pattern, Pattern, Pattern];

  // 00 Intro: chords, bass and a hats-only groove that builds into a fill.
  chords(intro);
  bass(intro);
  drums(intro, ["c.h.h.h.h.h.h.h.", "k.h.h.h.k.h.h.h.", "k.h.s.h.k.h.s.h.", "k.h.s.h.k.ssssss"]);

  // 01 Verse: the main theme (dotted rhythm 3-3-2) with a gentle vibrato and 25% duty.
  put(verse, 0, P1, { fx: "V", param: 1 });
  put(verse, 1, P1, { fx: "4", param: 0x34 });
  melody(verse, P1, LEAD, [
    [0, "E-5", 5],
    [6, "D-5", 5],
    [12, "C-5", 4],
    [16, "C-5", 5],
    [22, "A-4", 5],
    [28, "C-5", 2],
    [30, "D-5", 2],
    [32, "E-5", 5],
    [38, "G-5", 5],
    [44, "E-5", 4],
    [48, "D-5", 7],
    [56, "B-4", 4],
    [60, "D-5", 4],
  ]);
  chords(verse, [0, 3, 6, 8, 11, 14], 8);
  bass(verse);
  drums(verse, [`c${BEAT.slice(1)}`, BEAT, BEAT, BEAT_B]);

  // 02 Answer: the theme climbs, thinner 12.5% duty, with an echo on pulse 2 (3 rows late).
  const answerNotes: [number, string, number][] = [
    [0, "A-5", 5],
    [6, "G-5", 5],
    [12, "E-5", 4],
    [16, "F-5", 5],
    [22, "E-5", 5],
    [28, "C-5", 4],
    [32, "E-5", 3],
    [36, "G-5", 3],
    [40, "C-6", 8],
    [48, "B-5", 5],
    [54, "G-5", 5],
    [60, "D-5", 4],
  ];
  put(answer, 0, P1, { fx: "V", param: 0 });
  put(answer, 40, P1, { fx: "V", param: 2 });
  put(answer, 48, P1, { fx: "V", param: 0 });
  melody(answer, P1, LEAD, answerNotes);
  melody(
    answer,
    P2,
    ECHO,
    answerNotes.filter(([row]) => row + 3 < length).map(([row, note, len]) => [row + 3, note, len]),
    6,
  );
  put(answer, 3, P2, { fx: "V", param: 1 });
  bass(answer);
  drums(answer, [BEAT, BEAT, BEAT, "k.h.s.hkk.s.ssss"]);

  // 03 Bridge: half-time bass, long notes with slides and a snare roll back into the verse.
  melody(bridge, P1, LEAD, [
    [0, "A-5", 15],
    [16, "F-5", 15],
    [32, "G-5", 12],
    [44, "E-5", 4],
    [48, "B-5", 14],
  ]);
  put(bridge, 0, P1, { fx: "4", param: 0x46 });
  put(bridge, 56, P1, { fx: "2", param: 0x03 });
  put(bridge, 62, P1, { fx: "2", param: 0 });
  chords(bridge, [0, 8], 6);
  bass(bridge, true);
  drums(bridge, ["k...s...k...s...", "k...s...k...s...", "k.h.s.h.k.h.s.h.", "k.s.s.s.ssssssss"]);
  for (let row = 48; row < 64; row++) put(bridge, row, NOI, { vol: 6 + ((row - 48) >> 1) });

  return {
    title: "Lumen Quest",
    author: "Spark",
    bpm: 150,
    speed: 6,
    rowsPerBeat: 4,
    patternLength: length,
    patterns,
    order: [0, 1, 2, 1, 2, 3, 1, 2],
    instruments: [
      instrument("Lead", {
        volume: macro([15, 14, 13, 12, 11, 11, 10, 10, 9, 9, 7, 5, 3, 2, 1, 0], -1, 9),
      }),
      instrument("Chord arp", {
        volume: macro([11, 10, 9, 8, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 0]),
        duty: macro([0]),
      }),
      instrument("Bass", { volume: macro([15, 15, 15, 15, 15, 15, 15, 15, 15, 0]) }),
      instrument("Kick", {
        volume: macro([15, 14, 12, 9, 6, 3, 1, 0]),
        arpeggio: macro([0, -1, -2, -3, -4, -5]),
      }),
      instrument("Snare", {
        volume: macro([15, 13, 11, 9, 8, 6, 5, 4, 3, 2, 1, 0]),
        arpeggio: macro([2, 0]),
      }),
      instrument("Hat", { volume: macro([9, 6, 3, 1, 0]) }),
      instrument("Echo", {
        volume: macro([12, 11, 10, 9, 9, 8, 8, 7, 5, 3, 1, 0], -1, 7),
        duty: macro([1]),
      }),
      instrument("Crash", {
        volume: macro([
          15, 14, 13, 12, 11, 10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 0,
        ]),
        duty: macro([0]),
      }),
    ],
    mixer: defaultMixer(),
  };
}
