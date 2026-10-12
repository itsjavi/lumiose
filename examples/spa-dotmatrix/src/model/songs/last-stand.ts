// "Last Stand", a final battle: C harmonic minor, heavy. A four-bar ominous intro (bass pedal and
// racing arpeggios), then a sixteen-bar loop where the lead sings long, dramatic notes over them.
// One motif: a held note, then a two-eighth turn that steps into the next bar. The first phrase
// climbs C–E♭–A♭ over i–VI–iv and falls to D on V; the second climbs C–E♭–F–G and lands on the
// relative major (VII–III); the third peaks on E♭ sighing to D over V; the last comes back down to
// B, the leading tone, for the loop.
import { buildSong } from "../song.ts";
import { chords, drums, melody, repeat } from "../notation.ts";
import type { Song } from "../types.ts";

const LEAD = `
  .:16 | .:16 | .:16 | .:16 |
  C5:12 Eb5:2 D5:2 | Eb5:12 Ab5:2 G5:2 | Ab5:12 F5:2 Eb5:2 | D5:16 |
  C5:12 Eb5:2 D5:2 | Eb5:12 Ab5:2 G5:2 | F5:12 Bb5:2 Ab5:2 | G5:16 |
  C6:12 Bb5:2 Ab5:2 | G5:12 Ab5:2 Bb5:2 | C6:8 Eb6:8 | D6:16 |
  C6:12 Ab5:2 F5:2 | Eb5:12 F5:2 Eb5:2 | D5:12 Eb5:2 D5:2 | G5:4 F5:4 D5:4 B4:4 |`;

const CHORDS = "Cm Cm Ab G Cm Ab Fm G Cm Ab Bb Eb Fm Cm Ab G Fm Ab G G";
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
