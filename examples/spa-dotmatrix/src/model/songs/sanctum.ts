// "Sanctum of Light", a sacred theme in D major. Two bars of harp on I and IV, then a sixteen-bar
// loop of four four-bar phrases: a rising motif (dotted quarter, eighth, half) asks on I–IV–vi–V,
// answers on I–IV–V–I, then a second period colours the harmony with E major (II, the Lydian G#)
// before the final I–V–I cadence. Pulse 2 doubles the lead a third below; the organ bass moves
// between roots and fifths.
import { buildSong } from "../song.ts";
import { chords, drums, melody, repeat, thirdsBelow } from "../notation.ts";
import { SCALES } from "../music.ts";
import type { Song } from "../types.ts";

const INTRO = ".:16 | .:16 |";
const LEAD = `
  F#4:6 G4:2 A4:8 | B4:6 A4:2 G4:8 | F#4:6 E4:2 D4:8 | E4:6 F#4:2 E4:8 |
  F#4:6 G4:2 A4:8 | B4:6 D5:2 G5:8 | F#5:4 E5:4 C#5:4 E5:4 | D5:12 .:4 |
  D5:6 C#5:2 B4:8 | B4:6 A4:2 G4:8 | G#4:6 A4:2 B4:8 | C#5:6 B4:2 A4:8 |
  B4:6 C#5:2 D5:8 | F#5:6 E5:2 D5:8 | E5:4 C#5:4 A4:4 C#5:4 | D5:16 |`;

const INTRO_CHORDS = "D G";
const CHORDS = "D G Bm A D G A D Bm G E A G D A D";

export function sanctum(): Song {
  const lead = melody(`${INTRO} ${LEAD}`);
  const bass = melody(chords(`${INTRO_CHORDS} ${CHORDS}`, "1:6 5,:2 1:8", 3));
  return buildSong({
    title: "Sanctum of Light",
    bpm: 80,
    bars: 18,
    loop: 2,
    key: 2,
    scale: "major",
    tracks: [
      {
        preset: "reed",
        notes: lead,
        tweak: { volume: 10, vibrato: { delay: 16, depth: 2, rate: 4 } },
      },
      {
        preset: "echo",
        notes: [
          ...melody(chords(INTRO_CHORDS, "1:2 5 1' 3' 5' 3' 1' 5", 4)),
          ...thirdsBelow(lead, 2, SCALES.major.steps, bass),
        ],
        tweak: { volume: 6, gate: 0 },
      },
      { preset: "organ", notes: bass },
      {
        preset: "tight",
        notes: drums(
          `.:16 | .:16 | C:8 X:2 .:6 | ${repeat(".:8 X:2 .:6 |", 7)} C:8 X:2 .:6 | ${repeat(".:8 X:2 .:6 |", 7)}`,
        ),
        tweak: { volume: 7 },
      },
    ],
  });
}
