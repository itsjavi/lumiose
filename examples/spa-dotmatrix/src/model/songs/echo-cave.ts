// "Echo Cave", a dungeon theme in A minor. One bar of drips, then a sixteen-bar loop: a four-note
// motif (quarter, two eighths, half) in a low, mellow voice over i–VI–III–VII, a half cadence on
// E (V), then iv–i–♭II (the Phrygian B♭ for unease)–V and home to i. Pulse 2 drips single chord
// tones off the beat, high up; the bass walks between roots, fifths and octaves.
import { buildSong } from "../song.ts";
import { chords, drums, melody, repeat } from "../notation.ts";
import type { Song } from "../types.ts";

const LEAD = `
  .:16 |
  A4:4 C5:2 B4:2 A4:8 | A4:4 C5:2 D5:2 C5:8 | E5:4 D5:2 C5:2 G4:8 | B4:4 A4:2 G4:2 D5:8 |
  C5:4 B4:2 A4:2 E4:8 | F4:4 G4:2 A4:2 C5:8 | B4:4 C5:2 B4:2 G#4:8 | E4:12 .:4 |
  F4:4 E4:2 F4:2 A4:8 | C5:4 B4:2 A4:2 E5:8 | D5:4 C5:2 Bb4:2 F4:8 | G#4:4 A4:2 B4:2 E5:8 |
  E5:4 D5:2 C5:2 A4:8 | C5:4 B4:2 A4:2 F4:8 | B4:4 C5:2 B4:2 G#4:8 | A4:12 .:4 |`;

const CHORDS = "Am Am F C G Am F E E Dm Am Bb E Am F E Am";

export function echoCave(): Song {
  return buildSong({
    title: "Echo Cave",
    bpm: 92,
    bars: 17,
    loop: 1,
    key: 9,
    scale: "harmonicMinor",
    tracks: [
      {
        preset: "reed",
        notes: melody(LEAD),
        tweak: { volume: 9, duty: 1, vibrato: { delay: 18, depth: 2, rate: 5 } },
      },
      {
        preset: "bell",
        notes: melody(chords(CHORDS, ".:6 5':2 .:6 3':2", 5)),
        tweak: { volume: 7 },
      },
      { preset: "round", notes: melody(chords(CHORDS, "1:8 1':4 5:4", 2)), tweak: { volume: 10 } },
      {
        preset: "tight",
        notes: drums(`.:16 | ${repeat(".:4 X:2 .:6 L:2 .:2 |", 16)}`),
        tweak: { volume: 7 },
      },
    ],
  });
}
