// "Rival Clash", a battle theme in A harmonic minor at 168 BPM. Two bars of intro: the lead and the
// bass climb E–F–F#–G–G# together, every note pushed an eighth ahead of the beat, then stab at V.
// The sixteen-bar loop is four four-bar phrases built on one motif (a 3+3+2 push climbing to a
// chord tone): i–VI–iv–V asks, i–VI–V–i answers, iv–VII–III–V climbs to the high D, and the
// first phrase returns to turn back into the loop. Pulse 2 echoes the lead an eighth note later,
// so the lead never moves by a semitone just before a beat; the saw bass hammers sixteenths.
import { buildSong } from "../song.ts";
import { chords, delay, drums, melody, repeat } from "../notation.ts";
import type { Song } from "../types.ts";

const INTRO = "E5:2 F5:4 F#5:4 G5:4 G#5:2 | G#5:2 A5:4 G#5:2 E5:4 B4:4 |";

const LEAD = `
  A4:3 C5:3 D5:2 E5:4 D5:2 C5:2 | A4:3 C5:3 D5:2 F5:4 D5:2 C5:2 |
  D5:3 F5:3 G5:2 A5:4 G5:4 | E5:3 D5:3 B4:2 G#4:8 |
  C5:3 D5:3 E5:2 A5:6 G5:2 | F5:3 A5:3 G5:2 F5:4 D5:4 |
  B4:2 C5:1 B4:1 G#4:2 B4:2 E5:4 D5:2 B4:2 | A4:3 B4:3 C5:2 A4:8 |
  D5:3 E5:3 F5:2 A5:4 G5:2 F5:2 | G5:3 F5:3 E5:2 D5:4 B4:4 |
  E5:3 G5:3 A5:2 C6:4 A5:2 G5:2 | B5:3 D6:3 B5:2 G#5:4 E5:4 |
  A4:3 C5:3 D5:2 E5:4 D5:2 C5:2 | A4:3 C5:3 F5:2 A5:4 G5:2 F5:2 |
  D5:3 E5:3 F5:2 A5:4 G5:4 | E5:3 D5:3 B4:2 G#4:4 B4:4 |`;

// The bass climbs with the lead in the first intro bar, then holds E (V).
const INTRO_BASS = "E2:1 E2 F2 F2 F3 F2 F#2 F#2 F#3 F#2 G2 G2 G3 G2 G#2 G#2 |";
const CHORDS = "Am F Dm E Am F E Am Dm G C E Am F Dm E";
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
        notes: melody(`${INTRO_BASS} ${chords(`E ${CHORDS}`, OSTINATO, 2)}`),
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
