// "Lines", a piano sketch in F major at 100 BPM, arranged for the four channels. The score's first
// ten bars are the intro (held chords under the tune) and its repeat sign at bar 11 is the loop
// marker. The lead is the right hand note for note. Pulse 2 breaks the left hand's chords into
// eighths in the intro, plays off-beat stabs in the loop and sings a third below the lead in the
// second half. The wave bass plays the left hand's lowest line.
import { buildSong } from "../song.ts";
import { chords, drums, melody, repeat, thirdsBelow } from "../notation.ts";
import { SCALES } from "../music.ts";
import { STEPS_PER_BAR, type Song } from "../types.ts";

const PICKUP = ".:8 C5:2 A5 A5 G5 |";

// Bars 2–9, played again as bars 11–18.
const THEME = `
  A5:2 G5 G5 F5 F5 E5 .:2 C5:2 | _:4 .:4 C5:2 A5 A5 G5 | A5:2 G5 G5 F5 E5 C5 D5 E5 |
  _:4 .:2 . A5 G5 G5 F5 | F5:2 D5 D5 D5 _ F5 G5 F5 | _:2 E5 _ E5 E5 F5 G5 A5 |
  _:2 G5 G5 F5 E5 F5 E5 D5 | _:16 |`;

// Bars 19–26; bar 24 is the lead alone.
const BRIDGE = `
  D5:6 E5:6 F5:4 | E5:6 F5:6 G5:4 | A5:2 G5 F5 D5 _:8 | Bb5:2 A5 A5 G5 G5 F5 F5 D5 |
  E5:16 | .:4 F5:2 F5 A5 F5 F5 F5 | .:8 F5:2 A5 F5 G5 | _:2 F5 F5 E5 E5 D5 C5 Bb4 |`;

// The left hand's chords in the intro, in its own voicings, broken into eighths.
const INTRO_CHORDS = `
  .:16 | F3:2 A3 C4 A3 F3 A3 C4 A3 | F3:2 A3 C4 A3 .:8 |
  E3:2 A3 C4 A3 E3 A3 C4 A3 | E3:2 A3 C4 A3 .:8 | Bb2:2 D3 F3 D3 Bb2 D3 F3 D3 |
  C3:2 E3 G3 E3 C3 E3 G3 E3 | D3:2 F3 A3 F3 C3 E3 G3 E3 | Bb2:2 D3 F3 D3 Bb2 D3 F3 D3 |
  Bb2:2 D3 F3 D3 .:8 |`;

const STABS = `
  ${chords("F F Am Am Dm C", ".:2 3 . 5 . 3 . 5", 4)}
  .:2 F4 . A4 . E4 . G4 | .:2 D4 . F4 . D4 . F4 |`;

// The intro holds the lowest note of each chord an octave down; the loop is the left hand's line.
const BASS = `
  .:16 | F2:16 | _:8 .:8 | E2:16 | _:8 .:8 | Bb1:16 | C2:16 | D2:8 C2:8 | Bb1:16 | _:8 .:8 |
  F2:4 C3 F3 C3 | F2:4 C3 F3 C3 | A2:4 E3 A3 E3 | A2:4 E3 A3 E3 | D3:4 F3 A3 F3 | C3:4 E3 G3 E3 |
  D3:8 C3:8 | Bb2:6 D3:6 Bb2:4 | Bb1:6 Bb2:6 Bb2:2 Bb1:2 | C2:6 C3:6 C3:2 C2:2 | D2:6 D3:6 C3:4 |
  Bb2:16 | C3:6 G3:2 C4 E4 C5:4 | .:16 | F3:6 A3:6 F3:4 | C3:6 E3:6 C3:4 |`;

const BEAT = "K:2 H S H K K S H |";
const FILL = "K:2 H S H K S:1 S T:2 L |";

const bar = (n: number) => (n - 1) * STEPS_PER_BAR;

export function lines(): Song {
  const lead = melody(`${PICKUP} ${THEME} ${PICKUP} ${THEME} ${BRIDGE}`);
  const bass = melody(BASS);
  // The second half's harmony: a third below the lead, leaving bar 24 to the lead alone.
  const thirds = thirdsBelow(
    lead.filter((n) => n.s >= bar(19) && (n.s < bar(24) || n.s >= bar(25))),
    5,
    SCALES.major.steps,
    bass,
  );
  return buildSong({
    title: "Lines",
    author: "Javi Aguilar",
    bpm: 100,
    bars: 26,
    loop: 10,
    key: 5,
    scale: "major",
    tracks: [
      { preset: "hero", notes: lead },
      {
        preset: "echo",
        notes: [...melody(`${INTRO_CHORDS} ${STABS}`), ...thirds],
      },
      { preset: "round", notes: bass },
      {
        preset: "kit",
        notes: drums(
          `.:16 | ${repeat(".:4 X . X |", 8)} .:8 S:2 S:1 S T:2 L |
           C:2 H S H K K S H | ${repeat(BEAT, 6)} ${FILL}
           C:2 H S H K K S H | ${repeat(BEAT, 4)} K:4 .:4 S:2 S T L | ${BEAT}
           K:2 H S H S:1 S S S T:2 L |`,
        ),
      },
    ],
  });
}
