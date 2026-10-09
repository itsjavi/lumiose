import { describe, expect, it } from "vitest";
import { sfxData } from "../audio/driver.ts";
import { parseCode } from "./code.ts";
import { BASES, CREATURES, baseById, creatureSfx, cryHeader } from "./creatures.ts";
import { SFX, listing } from "./sfx.ts";
import type { Sfx } from "./types.ts";

const sounds: { sfx: Sfx; header?: string }[] = [
  ...SFX.map((sfx) => ({ sfx })),
  ...CREATURES.map((c) => ({
    sfx: creatureSfx(c),
    header: cryHeader(baseById(c.base), c.pitch, c.length),
  })),
];

describe("driver code", () => {
  for (const { sfx, header } of sounds) {
    it(`${sfx.name}: exports to code and imports back identically`, () => {
      const code = header ? `${header}\n${listing(sfx)}` : listing(sfx);
      const result = parseCode(code, sfx.name);
      if ("errors" in result)
        throw new Error(result.errors.map((e) => `${e.line}: ${e.message}`).join("\n"));
      // The same register writes at the same times, and the same code again.
      expect(sfxData(result.sfx).channels).toEqual(sfxData(sfx).channels);
      expect(listing(result.sfx)).toBe(listing(sfx));
    });
  }

  it("has twenty creatures on twenty base voices", () => {
    expect(CREATURES).toHaveLength(20);
    expect(BASES).toHaveLength(20);
    expect(new Set(CREATURES.map((c) => c.base)).size).toBe(20);
  });

  it("reports errors by line", () => {
    const result = parseCode(
      [
        "square_note 1, 2, 3, 4",
        "; pulse 1",
        "  sqare_note 4, 12, 1, $700",
        "  square_note 4, 16, 1, $700",
        "  square_note 4, 12, 1",
        "  noise_note 2, 10, 1, $23",
        "  pitch_sweep 3, 1",
        "  duty_cycle x",
        "  sound_ret",
        "  duty_cycle 2",
        "; wave",
      ].join("\n"),
    );
    expect("errors" in result && result.errors).toEqual([
      { line: 1, message: "Start with a channel line: “; pulse 1”, “; pulse 2” or “; noise”" },
      { line: 3, message: "Unknown command “sqare_note”" },
      { line: 4, message: "The volume must be 0–15, found 16" },
      { line: 5, message: "square_note takes 4 numbers, found 3" },
      { line: 6, message: "noise_note is for the noise channel; use square_note here" },
      {
        line: 7,
        message: expect.stringMatching(/^Dotmatrix plays these sweeps: /) as unknown as string,
      },
      { line: 8, message: "“x” is not a number (write 12 or $0C)" },
      { line: 10, message: "Code after sound_ret: start a new channel section first" },
      {
        line: 11,
        message: "Sound effects use pulse 1, pulse 2 and noise; the wave channel is for songs",
      },
    ]);
  });

  it("reads hand-written code: hex or decimal, comments, rests and slides", () => {
    const result = parseCode(
      [
        "; my laser",
        "; pulse 1",
        "duty_cycle_pattern 0, 0, 3, 3 ; rasp",
        "square_note 3, 15, 1, 1990 ; slides -12/frame",
        "square_note 2, 0, 0, 0",
        "square_note 10, $0C, 3, $7A0",
        "; noise",
        "noise_note 4, 9, 2, $11",
      ].join("\n"),
      "Laser",
    );
    if (!("sfx" in result)) throw new Error(JSON.stringify(result.errors));
    expect(result.frames).toBe(15);
    expect(result.sfx.name).toBe("Laser");
    const [pulse, noise] = result.sfx.voices;
    expect(pulse!.notes[0]).toMatchObject({
      frames: 3,
      volume: 15,
      env: 7,
      pattern: 0b00001111,
      slide: -12,
    });
    expect(pulse!.notes[1]).toMatchObject({ volume: 0 });
    expect(noise!.notes[0]).toMatchObject({ frames: 4, volume: 9, env: 6, noise: 0x11 });
  });
});
