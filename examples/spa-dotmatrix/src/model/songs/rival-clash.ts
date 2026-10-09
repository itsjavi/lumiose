// "Rival Clash", a battle theme: A harmonic minor, fast. A rising two-bar intro, then a driving
// loop: a thin 12.5% lead, Pulse 2 echoing it an eighth note later, a sixteenth-note saw bass.
import { buildSong } from "../song.ts";
import { chords, delay, drums, melody, repeat } from "../notation.ts";
import type { Song } from "../types.ts";

const INTRO =
  "E5:1 .:1 E5:1 .:1 F5:1 .:1 F5:1 .:1 F#5:1 .:1 F#5:1 .:1 G5:1 .:1 G#5:2 | A5:1 .:3 A5:1 .:3 G#5:8 |";

const LEAD = `
  A4:3 C5:3 E5:2 A5:6 G5:2 | E5:3 C5:3 A4:2 B4:4 C5:4 | C5:3 F5:3 A5:2 G5:4 F5:4 | D5:3 G5:3 B5:2 A5:4 G5:4 |
  A5:3 G5:3 E5:2 A5:8 | C6:2 B5:2 A5:2 G5:2 E5:4 G5:4 | F5:3 E5:3 C5:2 F5:8 | E5:3 G#5:3 B5:2 E6:8 |
  D5:4 F5:4 A5:4 D6:4 | C6:6 B5:2 A5:8 | F5:4 A5:4 D6:6 C6:2 | B5:4 G#5:4 E5:8 |
  A5:3 G5:3 F5:2 E5:4 F5:4 | G5:3 F5:3 E5:2 D5:4 B4:4 | G#4:4 B4:4 E5:4 G#5:4 | B5:8 G#5:4 E5:4 |`;

const CHORDS = "Am Am F G Am Am F E Dm Am Dm E F G E E";
const OSTINATO = "1:1 1 1' 1 1 1 1' 1 1 1 1' 1 1 1 1' 1";

const BEAT = "K:2 H:1 H S:2 H:1 K K:2 H:1 H S:2 H |";
const FILL = "K:2 H:1 H S:2 H:1 K S:1 S S S T:2 L |";

export function rivalClash(): Song {
  const lead = melody(`${INTRO} ${LEAD}`);
  return buildSong({
    title: "Rival Clash",
    bpm: 168,
    bars: 18,
    loop: 2,
    key: 9,
    scale: "harmonicMinor",
    tracks: [
      { preset: "thin", notes: lead, pan: "C" },
      { preset: "echo", notes: delay(lead, 2, 18 * 16), tweak: { duty: 0, volume: 5 } },
      {
        preset: "saw",
        notes: melody(`${chords("E E", OSTINATO, 2)} ${chords(CHORDS, OSTINATO, 2)}`),
      },
      {
        preset: "bright",
        notes: drums(
          `K:1 .:3 K:1 .:3 K:1 .:3 S:1 S S S | S:1 S S S T:2 T L L K K |
           C:2 H:1 H S:2 H:1 K K:2 H:1 H S:2 H | ${repeat(BEAT, 2)} ${FILL} ${repeat(`${repeat(BEAT, 3)} ${FILL}`, 3)}`,
        ),
      },
    ],
  });
}
