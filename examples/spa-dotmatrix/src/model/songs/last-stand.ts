// "Last Stand", a final battle: C harmonic minor, heavy. A four-bar ominous intro (bass pedal and
// racing arpeggios), then a sixteen-bar loop where the lead sings long, dramatic notes over them.
import { buildSong } from "../song.ts";
import { chords, drums, melody, repeat } from "../notation.ts";
import type { Song } from "../types.ts";

const LEAD = `
  .:16 | .:16 | .:16 | .:16 |
  C5:12 Eb5:2 D5:2 | C5:4 G4:4 Eb5:8 | Ab5:12 G5:2 F5:2 | Eb5:8 C5:8 |
  F5:6 G5:2 Ab5:8 | C6:8 Ab5:8 | B5:12 Ab5:2 G5:2 | G5:16 |
  G5:4 C6:4 Eb6:8 | D6:8 Bb5:4 F5:4 | C6:6 Bb5:2 Ab5:8 | B5:8 D6:8 |
  Ab5:4 G5:4 F5:4 Eb5:4 | D5:4 Eb5:4 F5:4 B4:4 | C5:16 | B4:8 D5:4 G5:4 |`;

const CHORDS = "Cm Cm Ab G Cm Cm Ab Ab Fm Fm G G Cm Bb Ab G Fm G Cm G";
const BEAT = "K:2 K S:2 K K:2 K S:2 H |";
const FILL = "K:2 S T T L L S:1 S S S |";

export function lastStand(): Song {
  return buildSong({
    title: "Last Stand",
    bpm: 152,
    bars: 20,
    loop: 4,
    key: 0,
    scale: "harmonicMinor",
    tracks: [
      {
        preset: "hero",
        notes: melody(LEAD),
        tweak: { duty: 1, volume: 12, vibrato: { delay: 12, depth: 4, rate: 3 } },
      },
      {
        preset: "shimmer",
        notes: melody(chords(CHORDS, "1:1 5 1' 5 3' 5 1' 5 1 5 1' 5 3' 5 1' 5", 4)),
        tweak: { volume: 6, gate: 1 },
      },
      {
        preset: "saw",
        notes: melody(chords(CHORDS, "1:2 1 1 1' 1 1 1' 1", 2)),
        tweak: { volume: 15 },
      },
      {
        preset: "kit",
        notes: drums(
          `.:16 | .:16 | K:4 .:4 K:4 .:4 | K:2 K K K S:1 S S S S S S S |
           ${repeat(`C:2 K S:2 K K:2 K S:2 H | ${repeat(BEAT, 2)} ${FILL}`, 4)}`,
        ),
      },
    ],
  });
}
