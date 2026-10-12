// "Roll the Credits", an ending theme: G major, warm and a little nostalgic. A two-bar intro on the
// drums, then a sixteen-bar loop: a singing lead, shimmering broken chords and a walking bass. The
// opening rises up the G chord and sighs down by step; the second phrase answers with a half
// cadence on D; then the tune climbs by step to C and D at the top and settles on G.
import { buildSong } from "../song.ts";
import { chords, drums, melody, repeat } from "../notation.ts";
import type { Song } from "../types.ts";

const LEAD = `
  .:16 | .:16 |
  B4:4 D5:4 G5:6 F#5:2 | A5:6 G5:2 F#5:8 | E5:6 F#5:2 G5:8 | E5:4 D5:4 C5:4 B4:4 |
  B4:4 D5:4 G5:6 F#5:2 | A5:6 G5:2 F#5:4 D5:4 | E5:6 F#5:2 G5:4 E5:4 | F#5:12 .:4 |
  G5:6 A5:2 B5:8 | C6:6 B5:2 A5:4 G5:4 | B5:6 A5:2 G5:4 D5:4 | F#5:4 G5:4 A5:8 |
  C6:6 B5:2 A5:4 C6:4 | D6:6 C6:2 B5:4 A5:4 | B5:6 A5:2 G5:4 A5:4 | G5:12 .:4 |`;

const CHORDS = "G D G D Em C G D C D Em C G D C D G G";
const BEAT = "K:4 H:2 H S:4 H:2 H |";
const FILL = "K:4 H:2 H S:2 S T L |";

export function rollCredits(): Song {
  return buildSong({
    title: "Roll the Credits",
    bpm: 120,
    bars: 18,
    loop: 2,
    key: 7,
    scale: "major",
    tracks: [
      { preset: "hero", notes: melody(LEAD), tweak: { volume: 11, env: 1 } },
      {
        preset: "shimmer",
        notes: melody(chords(CHORDS, "1:2 3 5 3 1' 5 3 5", 4)),
        tweak: { volume: 6 },
      },
      { preset: "round", notes: melody(chords(CHORDS, "1:4 1:2 5,:2 1:4 5,:4", 2)) },
      {
        preset: "kit",
        notes: drums(
          `.:16 | K:4 .:4 S:4 S:2 S:2 | ${repeat(`C:4 H:2 H S:4 H:2 H | ${repeat(BEAT, 2)} ${FILL}`, 4)}`,
        ),
      },
    ],
  });
}
