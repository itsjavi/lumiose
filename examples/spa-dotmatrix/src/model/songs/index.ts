// The demo gallery: original songs in the style of late-90s handheld RPG soundtracks, each built
// to show a few techniques a beginner can find and tweak.
import type { Song } from "../types.ts";
import { firstSteps } from "./first-steps.ts";
import { lanternNight } from "./lantern-night.ts";
import { mapleHollow } from "./maple-hollow.ts";
import { overTheRidge } from "./over-the-ridge.ts";
import { rivalClash } from "./rival-clash.ts";
import { bumblingAlong } from "./bumbling-along.ts";
import { echoCave } from "./echo-cave.ts";
import { fadedLetters } from "./faded-letters.ts";
import { lastStand } from "./last-stand.ts";
import { rollCredits } from "./roll-credits.ts";
import { sanctum } from "./sanctum.ts";
import { wildEncounter } from "./wild-encounter.ts";

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
    id: "wild-encounter",
    title: "Wild Encounter",
    mood: "Battle",
    blurb: "Something jumped out of the tall grass. Fight or run!",
    tips: [
      "The motif (two eighths climbing to a long chord tone) returns four times, once inverted.",
      "Pulse 2 follows the lead a third below; the bass hammers root and octave eighths.",
      "i–♭VI–♭VII–i, with B major (V) at the turnarounds pulling back to E minor.",
    ],
    song: wildEncounter,
  },
  {
    id: "last-stand",
    title: "Last Stand",
    mood: "Final battle",
    blurb: "The last fight. Everything is on the line.",
    tips: [
      "Four bars of intro build the tension before the lead comes in.",
      "Pulse 2 races in sixteenth-note arpeggios while the lead holds long notes.",
      "The B natural of the harmonic minor makes every G chord pull back to C minor.",
    ],
    song: lastStand,
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
    id: "sanctum",
    title: "Sanctum of Light",
    mood: "Sacred",
    blurb: "A quiet hall of light where something old and kind lives.",
    tips: [
      "Four four-bar phrases: question, answer, a second question, the final answer on D.",
      "The E major chord (II) brings in the G#, a Lydian colour, before the cadence.",
      "Pulse 2 sings a third below the lead; the organ walks root, fifth, root.",
    ],
    song: sanctum,
  },
  {
    id: "echo-cave",
    title: "Echo Cave",
    mood: "Dungeon",
    blurb: "Damp walls, dripping water and something breathing in the dark.",
    tips: [
      "The four-note motif stays low; each phrase moves it to a new chord.",
      "The B♭ chord (a Phrygian ♭II) before E major gives the cave its unease.",
      "The drips are single chord tones, high up and always off the beat.",
    ],
    song: echoCave,
  },
  {
    id: "bumbling-along",
    title: "Bumbling Along",
    mood: "Goofy",
    blurb: "Someone is about to slip on a banana peel.",
    tips: [
      "A 12.5% duty with a deep, quick vibrato sounds like a kazoo.",
      "Chromatic steps (G, G#, A) and a slide down at the end are the jokes.",
      "Oom-pah: the bass on the beat, Pulse 2's chords off it.",
    ],
    song: bumblingAlong,
  },
  {
    id: "faded-letters",
    title: "Faded Letters",
    mood: "Sad",
    blurb: "Reading old letters from someone who is not coming back.",
    tips: [
      "Slow tempo and long notes; the vibrato only starts late in each note.",
      "The noise channel plays a soft double kick: a heartbeat.",
      "The C# in the last bar leads back to D minor for the loop.",
    ],
    song: fadedLetters,
  },
  {
    id: "roll-credits",
    title: "Roll the Credits",
    mood: "Credits",
    blurb: "The journey is over. Thank you for playing.",
    tips: [
      "The melody climbs higher in the second half, then settles on G.",
      "Shimmer on Pulse 2 gives the broken chords a chorus-like glow.",
      "A drum-only intro before the loop, like the start of a parade.",
    ],
    song: rollCredits,
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
