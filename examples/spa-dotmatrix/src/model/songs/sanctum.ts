// "Sanctum of Light", a sacred theme: D Lydian (the raised fourth, G#, makes it float), slow. Two
// bars of harp, then an eight-bar loop: a mellow lead over a held organ and harp arpeggios.
import { buildSong } from "../song.ts";
import { chords, drums, melody, repeat } from "../notation.ts";
import type { Song } from "../types.ts";

const LEAD = `
  .:16 | .:16 |
  A4:8 D5:8 | E5:12 G#4:4 | F#5:8 D5:4 B4:4 | D5:12 .:4 |
  G5:8 E5:4 B4:4 | C#5:8 E5:8 | F#5:6 E5:2 D5:8 | E5:8 C#5:4 A4:4 |`;

const CHORDS = "D D D E Bm G Em A D A";

export function sanctum(): Song {
  return buildSong({
    title: "Sanctum of Light",
    bpm: 72,
    bars: 10,
    loop: 2,
    key: 2,
    scale: "chromatic",
    tracks: [
      { preset: "reed", notes: melody(LEAD), tweak: { volume: 9, env: 0 } },
      {
        preset: "bell",
        notes: melody(chords(CHORDS, "1:2 5 1' 3' 5' 3' 1' 5", 4)),
        tweak: { volume: 8 },
      },
      { preset: "organ", notes: melody(chords(CHORDS, "1:8 5,:8", 3)) },
      {
        preset: "tight",
        notes: drums(`.:16 | .:16 | C:16 | ${repeat(".:16 |", 3)} C:16 | .:16 | .:16 | .:8 C:8 |`),
        tweak: { volume: 6 },
      },
    ],
  });
}
