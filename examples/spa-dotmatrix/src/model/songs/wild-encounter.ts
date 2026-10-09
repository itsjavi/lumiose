// "Wild Encounter", a battle with a wild creature in E minor. One bar of stabs on B (V), then a
// sixteen-bar loop: a driving motif (two eighths and a quarter climbing to the chord tone) over
// i–♭VI–♭VII–i, repeated higher and ending on a B major half cadence; then iv–i–♭VI–♭VII and the
// motif again, with V at the turnaround and the last bar on E. Pulse 2 follows a third below; the
// bass hammers root and octave eighths.
import { buildSong } from "../song.ts";
import { chords, drums, melody, repeat, thirdsBelow } from "../notation.ts";
import { SCALES } from "../music.ts";
import type { Song } from "../types.ts";

const LEAD = `
  .:16 |
  E5:2 F#5:2 G5:4 E5:8 | E5:2 F#5:2 G5:4 C5:8 | D5:2 E5:2 F#5:4 A5:8 | G5:6 F#5:2 E5:8 |
  E5:2 F#5:2 G5:4 B5:8 | C6:6 B5:2 G5:8 | A5:6 G5:2 F#5:8 | D#5:6 E5:2 F#5:8 |
  E5:2 D5:2 C5:4 A4:8 | G4:2 A4:2 B4:4 E5:8 | E5:2 F#5:2 G5:4 C6:8 | B5:4 A5:4 F#5:4 D5:4 |
  E5:2 F#5:2 G5:4 E5:8 | E5:2 F#5:2 G5:4 C5:8 | D#5:4 F#5:4 B5:4 F#5:4 | E5:12 .:4 |`;

const CHORDS = "Em C D Em Em C D B Am Em C D Em C B Em";
const BEAT = "K:2 H S H K K S H |";
const FILL = "K:2 H S:1 S S S T:2 T L L |";

export function wildEncounter(): Song {
  const lead = melody(LEAD);
  const bass = melody(chords(`B ${CHORDS}`, "1:2 1' 1 1' 1 1' 1 1'", 2));
  return buildSong({
    title: "Wild Encounter",
    bpm: 168,
    bars: 17,
    loop: 1,
    key: 4,
    scale: "minor",
    tracks: [
      { preset: "hero", notes: lead, tweak: { vibrato: { delay: 10, depth: 3, rate: 2 } } },
      {
        preset: "echo",
        notes: [
          ...melody(chords("B", ".:2 5 . 5 . 5 1' 3'", 3)),
          ...thirdsBelow(lead, 4, SCALES.minor.steps, bass),
        ],
        tweak: { volume: 7, gate: 1 },
      },
      { preset: "punch", notes: bass },
      {
        preset: "bright",
        notes: drums(
          `S:1 S S S S S S S T:2 T L L | ${repeat(`C:2 H S H K K S H | ${repeat(BEAT, 6)} ${FILL}`, 2)}`,
        ),
      },
    ],
  });
}
