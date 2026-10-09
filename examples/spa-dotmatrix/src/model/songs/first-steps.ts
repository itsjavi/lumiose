// "First Steps": the song a new studio opens with. Four bars in C major, one idea per channel.
import { buildSong } from "../song.ts";
import { chords, drums, melody, repeat } from "../notation.ts";
import type { Song } from "../types.ts";

const CHORDS = "C F G C";

export function firstSteps(): Song {
  return buildSong({
    title: "First Steps",
    bpm: 112,
    bars: 4,
    key: 0,
    scale: "major",
    tracks: [
      {
        preset: "hero",
        notes: melody("C5:4 E5 G5 E5 | F5:4 A5 G5:8 | E5:4 D5 C5 D5 | C5:12 .:4 |"),
      },
      { preset: "echo", notes: melody(chords(CHORDS, "1:2 5 3' 5 1 5 3' 5", 3)) },
      { preset: "round", notes: melody(chords(CHORDS, "1:4 5, 1 5,", 2)) },
      { preset: "kit", notes: drums(repeat("K:2 H S H K K S H |", 4)) },
    ],
  });
}
