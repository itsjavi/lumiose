// "Faded Letters", a sad theme: D minor, very slow. One bar of arpeggio, then an eight-bar loop: a
// reedy lead with a late vibrato, a soft broken-chord accompaniment and a heartbeat on the noise.
import { buildSong } from "../song.ts";
import { chords, drums, melody, repeat } from "../notation.ts";
import type { Song } from "../types.ts";

const LEAD = `
  .:16 |
  A4:8 D5:4 E5:4 | F5:8 E5:4 D5:4 | D5:6 C5:2 Bb4:8 | A4:12 .:4 |
  A4:4 D5:4 F5:6 E5:2 | C5:8 A4:4 C5:4 | Bb4:6 A4:2 G4:8 | C#5:8 E5:4 A4:4 |`;

const CHORDS = "Dm Dm Bb Gm A Dm F Gm A";

export function fadedLetters(): Song {
  return buildSong({
    title: "Faded Letters",
    bpm: 66,
    bars: 9,
    loop: 1,
    key: 2,
    scale: "harmonicMinor",
    tracks: [
      {
        preset: "reed",
        notes: melody(LEAD),
        tweak: { volume: 10, vibrato: { delay: 20, depth: 3, rate: 4 } },
      },
      {
        preset: "echo",
        notes: melody(chords(CHORDS, ".:2 1 5 3' 5 1 5 3'", 3)),
        tweak: { gate: 0, volume: 5 },
      },
      { preset: "round", notes: melody(chords(CHORDS, "1:8 5,:8", 2)), tweak: { volume: 8 } },
      { preset: "tight", notes: drums(`.:16 | ${repeat("K:2 K:14 |", 8)}`), tweak: { volume: 6 } },
    ],
  });
}
