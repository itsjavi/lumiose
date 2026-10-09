// The demo gallery: original songs in the style of late-90s handheld RPG soundtracks, each built
// to show a few techniques a beginner can find and tweak.
import type { Song } from "../types.ts";
import { firstSteps } from "./first-steps.ts";
import { lanternNight } from "./lantern-night.ts";
import { mapleHollow } from "./maple-hollow.ts";
import { overTheRidge } from "./over-the-ridge.ts";
import { rivalClash } from "./rival-clash.ts";

export interface Demo {
  id: string;
  title: string;
  mood: string;
  blurb: string;
  /** Things to listen for and try. */
  tips: string[];
  song: () => Song;
}

export const DEMOS: Demo[] = [
  {
    id: "maple-hollow",
    title: "Maple Hollow",
    mood: "Town",
    blurb: "A cosy hometown tune that loops forever without getting old.",
    tips: [
      "The lead's vibrato only starts after a short delay, so short notes stay clean.",
      "Pulse 2 plays broken chords quietly under the tune.",
      "Try the Hero lead preset on Pulse 1 for a brighter town.",
    ],
    song: mapleHollow,
  },
  {
    id: "over-the-ridge",
    title: "Over the Ridge",
    mood: "Route",
    blurb: "Brisk walking music for the road out of town.",
    tips: [
      "The first two bars are an intro: the loop marker starts the repeat at bar 3.",
      "Pulse 2 plays short off-beat stabs: its notes use the short gate.",
      "The bass jumps an octave every other eighth note.",
    ],
    song: overTheRidge,
  },
  {
    id: "rival-clash",
    title: "Rival Clash",
    mood: "Battle",
    blurb: "Fast, tense and in a minor key: someone wants a rematch.",
    tips: [
      "Pulse 2 is the lead again, delayed by an eighth note and quieter: an echo.",
      "The saw bass hammers sixteenth notes; mute it to hear how much it drives.",
      "The harmonic minor scale gives the G# that makes it sound urgent.",
    ],
    song: rivalClash,
  },
  {
    id: "lantern-night",
    title: "Lantern Night",
    mood: "Night",
    blurb: "A slow lullaby for a sleeping village.",
    tips: [
      "The lead glides between notes that touch: the Slide lead preset.",
      "The wave channel plays a pad at half volume with a slow vibrato.",
      "Music box pings on Pulse 2 fade out on their own: a fast envelope.",
    ],
    song: lanternNight,
  },
  {
    id: "first-steps",
    title: "First Steps",
    mood: "Tutorial",
    blurb: "Four bars, one idea per channel: the song a new studio starts with.",
    tips: [
      "Every channel uses its first preset: a good place to start.",
      "Add notes in the empty last beat, then press Play.",
    ],
    song: firstSteps,
  },
];

export const demo = (id: string): Demo | undefined => DEMOS.find((d) => d.id === id);
