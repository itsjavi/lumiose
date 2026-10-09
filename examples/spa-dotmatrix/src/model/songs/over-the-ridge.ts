// "Over the Ridge", a route theme: D major, brisk. A two-bar intro on the dominant, then a
// sixteen-bar loop: a bold 50% lead, off-beat chord stabs on Pulse 2, an octave-jumping bass.
import { buildSong } from "../song.ts";
import { chords, drums, melody, repeat } from "../notation.ts";
import type { Song } from "../types.ts";

const INTRO = ".:16 | .:16 |";

const LEAD = `
  D5:4 F#5:2 A5:6 F#5:4 | G5:4 B5:4 A5:2 G5:2 F#5:4 | E5:6 F#5:2 G5:4 E5:4 | F#5:4 D5:4 A4:8 |
  B4:4 D5:2 F#5:6 E5:4 | D5:4 B4:4 G5:8 | G5:4 F#5:2 E5:6 B4:4 | C#5:4 E5:4 A5:8 |
  A5:6 F#5:2 D6:8 | C#6:4 A5:4 F#5:8 | B5:4 A5:2 G5:2 D5:4 G5:4 | A5:6 G5:2 F#5:4 E5:4 |
  D5:4 F#5:4 B5:6 A5:2 | G5:4 F#5:2 G5:2 B5:8 | A5:4 G5:2 F#5:2 E5:4 C#5:4 | E5:4 F#5:2 G5:2 A5:8 |`;

const CHORDS = "D G A D Bm G Em A D F#m G A Bm G A A";

const BEAT = "K:2 H S H K K S H |";
const FILL = "K:2 H S H K S:1 S T:2 L |";

export function overTheRidge(): Song {
  return buildSong({
    title: "Over the Ridge",
    bpm: 138,
    bars: 18,
    loop: 2,
    key: 2,
    scale: "major",
    tracks: [
      { preset: "hero", notes: melody(`${INTRO} ${LEAD}`) },
      {
        preset: "echo",
        notes: melody(
          `${chords("A A", "1:2 3 5 1' 3' 5' 3' 1'", 4)} ${chords(CHORDS, ".:2 3 . 5 . 3 . 5", 4)}`,
        ),
        tweak: { gate: 2, volume: 7 },
      },
      {
        preset: "punch",
        notes: melody(
          `${chords("A A", "1:2 1 1' 1 1 1 1' 1", 2)} ${chords(CHORDS, "1:2 1 1' 1 5 1 1' 5", 2)}`,
        ),
      },
      {
        preset: "kit",
        notes: drums(
          `K:2 H K H K H K H | K:2 S K S S:1 S S S T:2 L | C:2 H S H K K S H | ${repeat(BEAT, 2)} ${FILL}
           ${repeat(`${repeat(BEAT, 3)} ${FILL}`, 3)}`,
        ),
      },
    ],
  });
}
