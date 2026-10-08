import { describe, expect, it } from "vitest";
import { demoSong } from "../model/demo.ts";
import { emptySong } from "../model/song.ts";
import { NOTE_OFF } from "../model/types.ts";
import { HEADER, SCOPE_SIZE, Synth, Voice, songDuration } from "./synth.ts";

const SR = 48000;

function renderSeconds(synth: Synth, seconds: number) {
  const left = new Float32Array(128);
  const right = new Float32Array(128);
  let peak = 0;
  for (let i = 0; i < (seconds * SR) / 128; i++) {
    synth.render(left, right);
    for (const s of left) peak = Math.max(peak, Math.abs(s));
  }
  return peak;
}

describe("Synth", () => {
  it("plays the demo song with audible output and advancing rows", () => {
    const synth = new Synth(demoSong(), SR);
    synth.play("song", 0, 0);
    const peak = renderSeconds(synth, 1);
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThanOrEqual(1);
    // 1 s at 150 BPM, speed 6 = 10 rows.
    expect(synth.telemetry.header[HEADER.row]).toBe(10);
    expect(synth.telemetry.levels.some((level) => level > 0)).toBe(true);
    expect(synth.telemetry.header[HEADER.scopePos]).toBe((SR / 128) * 128 % SCOPE_SIZE);
  });

  it("is silent when stopped and when every channel is muted", () => {
    const song = demoSong();
    const synth = new Synth(song, SR);
    expect(renderSeconds(synth, 0.2)).toBe(0);
    for (const channel of song.mixer.channels) channel.mute = true;
    synth.updateMix();
    synth.play("song");
    expect(renderSeconds(synth, 0.5)).toBe(0);
  });

  it("loops one pattern in pattern mode and ends in once mode", () => {
    const song = demoSong();
    const synth = new Synth(song, SR);
    synth.play("pattern", 2, 60);
    renderSeconds(synth, 0.6);
    expect(synth.seq.order).toBe(2);
    expect(synth.seq.row).toBe(2);

    const once = new Synth(emptySong(), SR);
    once.play("once");
    renderSeconds(once, 6.5); // 64 rows of 0.1 s
    expect(once.playing).toBe(false);
    expect(once.seq.ended).toBe(true);
  });

  it("follows speed and jump effects in songDuration", () => {
    expect(songDuration(demoSong())).toBeCloseTo(8 * 64 * 0.1, 5);
    const song = emptySong();
    song.patterns[0]!.rows[0]![0]!.fx = "F";
    song.patterns[0]!.rows[0]![0]!.param = 3; // speed 3: half the time
    song.patterns[0]!.rows[31]![1]!.fx = "D"; // break at row 31 → order 1 wraps → end
    expect(songDuration(song)).toBeCloseTo(32 * 3 * (2.5 / 150), 5);
  });

  it("runs volume macros with release and cuts on OFF without a release point", () => {
    const song = emptySong();
    song.instruments[0]!.volume = { values: [15, 10, 5, 0], loop: -1, release: 1 };
    const voice = new Voice("pulse");
    voice.apply({ note: 48, inst: 0, vol: -1, fx: "", param: 0 }, song);
    const vols = [];
    for (let i = 0; i < 3; i++) {
      voice.tick(song);
      vols.push(voice.outVol);
    }
    expect(vols).toEqual([15, 10, 10]); // holds at the release point
    voice.apply({ note: NOTE_OFF, inst: -1, vol: -1, fx: "", param: 0 }, song);
    voice.tick(song);
    expect(voice.outVol).toBe(5);
    voice.tick(song);
    expect(voice.outVol).toBe(0);

    song.instruments[0]!.volume = { values: [15], loop: -1, release: -1 };
    voice.apply({ note: 48, inst: 0, vol: -1, fx: "", param: 0 }, song);
    voice.apply({ note: NOTE_OFF, inst: -1, vol: -1, fx: "", param: 0 }, song);
    voice.tick(song);
    expect(voice.outVol).toBe(0);
  });

  it("applies arpeggio, duty and noise settings", () => {
    const song = emptySong();
    song.instruments[0]!.volume = { values: [], loop: -1, release: -1 };
    song.instruments[0]!.duty = { values: [], loop: -1, release: -1 }; // else it overrides Vxx
    const pulse = new Voice("pulse");
    pulse.apply({ note: 57, inst: 0, vol: -1, fx: "0", param: 0x47 }, song);
    const hz = [];
    for (let i = 0; i < 3; i++) {
      pulse.tick(song);
      hz.push(Math.round(pulse.outHz));
    }
    expect(hz).toEqual([440, 554, 659]); // A, C#, E
    pulse.apply({ note: -1, inst: -1, vol: -1, fx: "V", param: 0 }, song);
    pulse.tick(song);
    expect(pulse.outDuty).toBe(0.125);

    const noise = new Voice("noise");
    noise.apply({ note: 15, inst: 0, vol: -1, fx: "V", param: 1 }, song);
    noise.tick(song);
    expect(noise.noiseShort).toBe(true);
    expect(noise.noiseRate).toBeCloseTo(1789773 / 4);
  });
});
