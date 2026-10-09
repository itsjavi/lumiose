// "Wild Encounter", a battle with a wild creature: E minor, very fast, rock-flavoured. One bar of
// octave-leaping stabs, then a sixteen-bar loop: a bold 50% lead, power-chord stabs on Pulse 2
// (a fifth arpeggio) and an octave-bouncing bass.
import { buildSong } from "../song.ts";
import { chords, drums, melody, repeat } from "../notation.ts";
import type { Song } from "../types.ts";

const INTRO = "E6:1 .:1 E5:1 .:1 D6:1 .:1 D5:1 .:1 C6:1 .:1 C5:1 .:1 B5:2 B4:2 |";

const LEAD = `
  E5:2 F#5 G5:4 B5:4 A5:2 G5:2 | F#5:4 E5:4 D5:4 B4:4 | A4:2 B4 D5:4 F#5:6 E5:2 | D5:12 .:4 |
  E5:2 G5 C6:4 B5:4 G5:4 | A5:6 G5:2 E5:8 | D#5:4 F#5:4 B5:6 A5:2 | F#5:8 D#5:8 |
  E5:2 F#5 G5:4 B5:4 E6:4 | D6:4 B5:4 G5:4 E5:4 | D5:2 G5 B5:4 D6:6 B5:2 | A5:8 F#5:8 |
  G5:4 E5:4 C5:4 E5:4 | F#5:4 A5:4 D6:8 | D#6:6 B5:2 F#5:8 | B5:4 A5:4 G5:4 F#5:4 |`;

const CHORDS = "Em Em D D C C B B Em Em G D C D B B";
const BEAT = "K:2 H K S:2 H K H S:2 |";
const FILL = "S:1 S S S T:2 T L:2 L K:2 K |";

export function wildEncounter(): Song {
  return buildSong({
    title: "Wild Encounter",
    bpm: 176,
    bars: 17,
    loop: 1,
    key: 4,
    scale: "minor",
    tracks: [
      {
        preset: "hero",
        notes: melody(`${INTRO} ${LEAD}`),
        tweak: { vibrato: { delay: 10, depth: 3, rate: 2 } },
      },
      {
        preset: "arp",
        notes: melody(
          `${chords("B", ".:2 1 . 1 . 1 1 1", 3)} ${chords(CHORDS, ".:2 1 . 1 . 1 1:4", 3)}`,
        ),
        tweak: { arp: "fifth", gate: 2, volume: 7 },
      },
      {
        preset: "punch",
        notes: melody(
          `${chords("B", "1:2 1' 1 1' 1 1' 1 1'", 2)} ${chords(CHORDS, "1:2 1' 1 1' 1 1' 1 1'", 2)}`,
        ),
      },
      {
        preset: "bright",
        notes: drums(
          `S:1 S S S S S S S T:2 T L L | ${repeat(`C:2 H K S:2 H K H S:2 | ${repeat(BEAT, 6)} ${FILL}`, 2)}`,
        ),
      },
    ],
  });
}
