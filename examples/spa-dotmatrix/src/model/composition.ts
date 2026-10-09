// Composition heuristics for the demo songs. They do not judge taste; they catch the usual
// problems of a melody written without listening: weak notes on strong beats, too many leaps, a
// range nobody could sing, harsh seconds between channels, and a song that never comes home.
import { STEPS_PER_BAR, type Note, type Song } from "./types.ts";

export interface CompositionReport {
  /** Lead notes on beats 1 and 3 that sound with the harmony (consonant with the bass, or a pitch class of Pulse 2). */
  strongChordTones: number;
  /** Lead intervals of at most a whole tone (repeats included). */
  steps: number;
  /** Largest lead interval, in semitones. */
  maxLeap: number;
  /** Lead range, in semitones. */
  range: number;
  /** Beats where the lead is a minor second (or major seventh) away from Pulse 2 or the bass. */
  clashes: number;
  /**
   * The lead comes home: its last note is the tonic, or, in a song that loops, a note of the
   * dominant chord (the fifth, the leading tone or the second) that resolves at the loop start to a
   * note of the tonic chord.
   */
  endsOnTonic: boolean;
}

export const LIMITS = {
  strongChordTones: 0.75,
  steps: 0.5,
  maxLeap: 12,
  range: 19,
  clashes: 2,
} as const;

const at = (notes: readonly Note[], step: number) =>
  notes.find((n) => n.s <= step && step < n.s + n.l);
const pc = (p: number) => ((p % 12) + 12) % 12;
const CONSONANT = new Set([0, 3, 4, 7, 8, 9]);

export function analyse(song: Song): CompositionReport {
  const [lead, harmony, bass] = song.tracks.map((t) => t.notes.toSorted((a, b) => a.s - b.s));
  const total = song.bars * STEPS_PER_BAR;
  let strong = 0;
  let good = 0;
  let clashes = 0;
  for (let step = 0; step < total; step += 4) {
    const l = at(lead!, step);
    if (!l) continue;
    const others = [at(harmony!, step), at(bass!, step)].filter((n): n is Note => !!n);
    if (others.some((o) => [1, 11].includes(pc(l.p - o.p)))) clashes++;
    if (step % 8 !== 0) continue;
    const b = at(bass!, step);
    const h = at(harmony!, step);
    if (!b && !h) continue;
    strong++;
    if (
      (b && CONSONANT.has(pc(l.p - b.p))) ||
      (h && pc(h.p) === pc(l.p)) ||
      (!b && h && CONSONANT.has(pc(l.p - h.p)))
    )
      good++;
  }
  const pitches = lead!.map((n) => n.p);
  const intervals = pitches.slice(1).map((p, i) => Math.abs(p - pitches[i]!));
  return {
    strongChordTones: strong ? good / strong : 1,
    steps: intervals.length ? intervals.filter((d) => d <= 2).length / intervals.length : 1,
    maxLeap: Math.max(0, ...intervals),
    range: pitches.length ? Math.max(...pitches) - Math.min(...pitches) : 0,
    clashes,
    endsOnTonic: endsHome(song, lead!),
  };
}

function endsHome(song: Song, lead: readonly Note[]): boolean {
  const last = lead.at(-1);
  if (!last) return false;
  const degree = (p: number) => pc(p - song.key);
  if (degree(last.p) === 0) return true;
  // A turnaround: V (fifth, leading tone or second) into the loop, which starts on the tonic chord.
  const loopStep = song.loop * STEPS_PER_BAR;
  const restart = lead.find((n) => n.s >= loopStep);
  return (
    !!restart && [7, 11, 2].includes(degree(last.p)) && [0, 3, 4, 7].includes(degree(restart.p))
  );
}

/** What a song misses, in words (empty when it passes). */
export function failures(report: CompositionReport): string[] {
  const out: string[] = [];
  if (report.strongChordTones < LIMITS.strongChordTones)
    out.push(`strong-beat chord tones ${Math.round(report.strongChordTones * 100)}% (want ≥ 75%)`);
  if (report.steps < LIMITS.steps)
    out.push(`steps ${Math.round(report.steps * 100)}% of intervals (want ≥ 50%)`);
  if (report.maxLeap > LIMITS.maxLeap)
    out.push(`a leap of ${report.maxLeap} semitones (want ≤ 12)`);
  if (report.range > LIMITS.range) out.push(`a range of ${report.range} semitones (want ≤ 19)`);
  if (report.clashes > LIMITS.clashes)
    out.push(`${report.clashes} minor-second clashes on beats (want ≤ 2)`);
  if (!report.endsOnTonic)
    out.push("the lead does not come home (tonic, or V into a tonic loop start)");
  return out;
}
