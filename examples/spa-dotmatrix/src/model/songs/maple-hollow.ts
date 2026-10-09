// "Maple Hollow", a town theme: F major at an easy walking pace. An eight-bar tune and an
// eight-bar answer over I–vi–IV–V; a reed lead with a late vibrato, broken chords on Pulse 2.
import { buildSong } from "../song.ts";
import { chords, drums, melody, repeat } from "../notation.ts";
import type { Song } from "../types.ts";

const LEAD = `
  C5:6 A4:2 F4:4 A4:4 | G4:6 A4:2 C5:8 | D5:6 C5:2 Bb4:4 A4:4 | G4:12 .:4 |
  C5:6 A4:2 F5:4 E5:4 | E5:4 D5:2 C5:2 A4:4 C5:4 | Bb4:4 D5:4 C5:4 E5:4 | F5:12 .:4 |
  A4:4 D5:4 F5:6 E5:2 | D5:6 C5:2 Bb4:8 | A4:4 C5:4 F5:4 C5:4 | E5:6 D5:2 C5:8 |
  F5:4 E5:2 D5:2 A4:8 | Bb4:4 C5:2 D5:2 F5:8 | G5:4 F5:2 E5:2 D5:4 Bb4:4 | C5:4 E5:4 G5:4 E5:4 |`;

const CHORDS = "F Am Bb C F Am C7 F Dm Bb F C Dm Bb Gm C7";

const GROOVE = "K:4 H:4 S:4 H:2 X:2 |";
const FILL = "K:4 H:4 S:2 S:2 T:2 L:2 |";

export function mapleHollow(): Song {
  return buildSong({
    title: "Maple Hollow",
    bpm: 104,
    bars: 16,
    key: 5,
    scale: "major",
    tracks: [
      { preset: "reed", notes: melody(LEAD) },
      {
        preset: "echo",
        notes: melody(chords(CHORDS, "1:2 5 3' 5 1' 5 3' 5", 3)),
        tweak: { volume: 5 },
      },
      { preset: "round", notes: melody(chords(CHORDS, "1:4 5, 1 5,", 2)) },
      {
        preset: "tight",
        notes: drums(
          `${repeat(GROOVE, 7)} ${FILL} C:4 H:4 S:4 H:2 X:2 | ${repeat(GROOVE, 6)} ${FILL}`,
        ),
      },
    ],
  });
}
