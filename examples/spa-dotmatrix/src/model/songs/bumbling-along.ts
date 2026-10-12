// "Bumbling Along", a goofy theme: F major with chromatic slips, bouncy. A kazoo-like 12.5% lead
// that slides between notes, an oom-pah bass and off-beat chords, in sixteen bars of AABA. The
// tune creeps up chromatically (G, G#, A, B♭) and trips down (F, E, E♭, D, C#); the second A
// sneaks back with G, A, B♭, B into C; the bridge climbs over B♭–F–G7–C7; and the last A stays
// low and ends on a slide down to F, the punchline.
import { buildSong } from "../song.ts";
import { chords, drums, melody, repeat } from "../notation.ts";
import type { Song } from "../types.ts";

const LEAD = `
  C5:2 .:2 A4:2 .:2 F4:2 G4 G#4 A4 | Bb4:6 A4:2 G4:4 .:4 |
  C5:2 .:2 A4:2 .:2 F5:2 E5:1 Eb5 D5:2 C#5 | C5:4 .:4 G4:2 A4 Bb4 B4 |
  C5:2 .:2 A4:2 .:2 F4:2 G4 G#4 A4 | Bb4:6 A4:2 G4:4 .:4 |
  E5:2 .:2 C5:2 .:2 G4:2 A4 Bb4 B4 | C5:2 .:2 A4:2 .:2 F4:4 .:4 |
  D5:2 .:2 D5:2 .:2 F5:4 D5:4 | C5:2 B4 C5:4 A4:8 |
  B4:2 C5 D5 F5 G5:4 F5:2 D5:2 | E5:2 .:2 C5:2 .:2 G4:4 .:4 |
  A4:4 G#4:2 A4:2 C5:4 A4:4 | F#4:2 .:2 F#4:2 .:2 A4:4 C5:4 |
  B4:4 A#4:2 B4:2 D5:4 B4:4 | C5:4 B4:1 A#4 A4 G#4 G4:2 F#4 F4:4 |`;

const CHORDS = "F Bb F C7 F Bb C7 F Bb F G7 C7 F D7 G7 C7";
const BEAT = "K:4 H:2 H S:4 T:2 L |";
const FILL = "K:4 H:2 H S:2 S T:1 T L L |";

export function bumblingAlong(): Song {
  return buildSong({
    title: "Bumbling Along",
    bpm: 132,
    bars: 16,
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
        notes: drums(repeat(`${repeat(BEAT, 3)} ${FILL}`, 4)),
        tweak: { volume: 9 },
      },
    ],
  });
}
