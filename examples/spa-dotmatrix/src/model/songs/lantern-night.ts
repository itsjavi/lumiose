// "Lantern Night", a calm night theme: E harmonic minor, slow. Two bars of music box and pad, then
// an eight-bar loop where the lead glides between touching notes over a soft wave pad.
import { buildSong } from "../song.ts";
import { chords, drums, melody, repeat } from "../notation.ts";
import type { Song } from "../types.ts";

const LEAD = `
  .:16 | .:16 |
  B4:8 G4:4 A4:4 | B4:6 C5:2 E5:8 | D5:8 C5:4 B4:4 | A4:8 F#4:4 D#4:4 |
  E4:6 G4:2 B4:8 | C5:6 B4:2 G4:8 | A4:6 B4:2 D5:4 F#5:4 | D#5:8 B4:8 |`;

const CHORDS = "Em Em Em Cmaj7 Am7 B7 Em C D B7";

export function lanternNight(): Song {
  return buildSong({
    title: "Lantern Night",
    bpm: 76,
    bars: 10,
    loop: 2,
    key: 4,
    scale: "harmonicMinor",
    tracks: [
      { preset: "slide", notes: melody(LEAD), tweak: { volume: 9 } },
      {
        preset: "bell",
        notes: melody(chords(CHORDS, ".:2 1' 5 3' . 5' 3' 1'", 4)),
        tweak: { volume: 7 },
      },
      { preset: "pad", notes: melody(chords(CHORDS, "1:8 5,:8", 3)) },
      {
        preset: "tight",
        notes: drums(`.:16 | .:16 | ${repeat(".:4 X . X |", 7)} .:4 X . L |`),
        tweak: { volume: 6 },
      },
    ],
  });
}
