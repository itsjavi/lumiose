// "Bumbling Along", a goofy theme: F major with chromatic slips, bouncy. A kazoo-like 12.5% lead
// that slides between notes, an oom-pah bass, off-beat chords and a sliding-down punchline.
import { buildSong } from "../song.ts";
import { chords, drums, melody, repeat } from "../notation.ts";
import type { Song } from "../types.ts";

const LEAD = `
  C5:2 .:2 A4:2 .:2 F4:2 G4 G#4 A4 | Bb4:6 A4:2 G4:4 .:4 | C5:2 .:2 A4:2 .:2 F5:4 E5:2 Eb5:2 |
  D5:2 C#5 C5:4 .:8 | D5:2 .:2 D5:2 .:2 F5:4 D5:4 | C5:2 B4 C5:4 A4:8 |
  B4:2 C5 D5 F5 G5:4 F5:2 D5:2 | E5:2 .:2 C5:2 .:2 G4:4 .:4 | A5:4 G#5:2 A5:2 C6:4 A5:4 |
  F#5:2 .:2 F#5:2 .:2 A5:4 C6:4 | B5:4 A#5:2 B5:2 D6:4 B5:4 | C6:2 B5 A#5 A5 G#5 G5 F#5 F5 |`;

const CHORDS = "F C7 F C7 Bb F G7 C7 F D7 G7 C7";
const BEAT = "K:4 H:2 H S:4 T:2 L |";
const FILL = "K:4 H:2 H S:2 S T:1 T L L |";

export function bumblingAlong(): Song {
  return buildSong({
    title: "Bumbling Along",
    bpm: 132,
    bars: 12,
    key: 5,
    scale: "chromatic",
    tracks: [
      {
        preset: "slide",
        notes: melody(LEAD),
        tweak: { duty: 0, volume: 12, glide: 4, vibrato: { delay: 6, depth: 4, rate: 2 } },
      },
      {
        preset: "echo",
        notes: melody(chords(CHORDS, ".:2 3 . 5 . 3 . 5", 4)),
        tweak: { gate: 2, volume: 7 },
      },
      { preset: "punch", notes: melody(chords(CHORDS, "1:2 . 5, . 1 . 5, .", 2)) },
      {
        preset: "tight",
        notes: drums(repeat(`${repeat(BEAT, 3)} ${FILL}`, 3)),
        tweak: { volume: 9 },
      },
    ],
  });
}
