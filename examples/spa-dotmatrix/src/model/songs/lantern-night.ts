// "Lantern Night", a calm night theme: E harmonic minor, slow. Two bars of music box and pad, then
// an eight-bar loop where the lead glides between touching notes over a soft wave pad. One rocking
// motif (a long note, a step, a long note) moves through i–VI–iv–V, a half cadence on B7, then
// climbs over III–iv–V to the high F#, and the D# leading tone resolves home to E.
import { buildSong } from "../song.ts";
import { chords, drums, melody, repeat } from "../notation.ts";
import type { Song } from "../types.ts";

const LEAD = `
  .:16 | .:16 |
  B4:6 A4:2 G4:8 | A4:6 G4:2 E4:8 | A4:6 B4:2 C5:8 | B4:6 A4:2 F#4:8 |
  G4:6 A4:2 B4:8 | C5:6 D5:2 E5:8 | F#5:6 E5:2 D#5:8 | E5:8 .:8 |`;

const CHORDS = "Em B7 Em C Am B7 G Am B7 Em";

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
