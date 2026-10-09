// "Echo Cave", a dungeon theme: A minor with a Phrygian Bb, slow and damp. An eight-bar loop: a
// low, mellow lead, water drips on the music box, a droning pad and the odd splash of noise.
import { buildSong } from "../song.ts";
import { chords, drums, melody, repeat } from "../notation.ts";
import type { Song } from "../types.ts";

const LEAD = `
  A4:8 C5:4 B4:4 | Bb4:12 A4:4 | E5:8 D5:4 C5:4 | D5:8 Bb4:8 |
  A4:4 E5:4 F5:8 | E5:4 D5:4 C5:8 | B4:8 G#4:8 | E4:12 .:4 |`;

const DRIPS = ".:6 E6:2 .:8 | .:10 A5:2 .:4 | .:4 C6:2 .:10 | .:12 G5:2 .:2 |";
const CHORDS = "Am Bb Am Bb Am F E E";

export function echoCave(): Song {
  return buildSong({
    title: "Echo Cave",
    bpm: 96,
    bars: 8,
    key: 9,
    scale: "chromatic",
    tracks: [
      { preset: "reed", notes: melody(LEAD), tweak: { volume: 8, duty: 1 } },
      { preset: "bell", notes: melody(repeat(DRIPS, 2)), tweak: { volume: 11 } },
      { preset: "pad", notes: melody(chords(CHORDS, "1:16", 2)) },
      {
        preset: "tight",
        notes: drums(repeat(".:8 X:2 .:6 | .:12 L:2 .:2 |", 4)),
        tweak: { volume: 8 },
      },
    ],
  });
}
