// The palette rules of decision-90, checked on the token values of both themes.

import { describe, expect, it } from "vitest";

import { dark, focus, gradient, light, radius, shadow } from "./tokens.ts";

type Palette = typeof light | typeof dark;
type Key = keyof Palette;

/** Tokens used as a text colour. */
const textTokens = [
  "text",
  "muted",
  "subtle",
  "accentText",
  "glowText",
  "codeFg",
  "inlineCodeFg",
  "infoFg",
  "warnFg",
  "tipFg",
  "synKeyword",
  "synString",
  "synComment",
  "synNumber",
  "synTag",
  "synAttr",
  "synProp",
  "synPunct",
] as const satisfies readonly Key[];

/** Tokens used as a background behind text. */
const surfaceTokens = [
  "bg",
  "surface",
  "sunken",
  "accentSoft",
  "codeBg",
  "infoBg",
  "warnBg",
  "tipBg",
] as const satisfies readonly Key[];

/** Borders of controls: 3:1 against the surfaces. Hairlines (`border`) are decoration. */
const controlBorderTokens = ["borderStrong"] as const satisfies readonly Key[];

/** The amber accent and the tokens that carry it. None of them is a text token. */
const amberTokens = ["accent", "accentHover", "glowA", "glowB"] as const satisfies readonly Key[];

const themes = [
  { name: "light", palette: light, bg: "#fff", text: "#000", grey: "#595959", accent: "#f5a300" },
  { name: "dark", palette: dark, bg: "#000", text: "#fff", grey: "#a3a3a3", accent: "#ffd27a" },
] as const;

/** The sRGB channels (0 to 1) of `#rgb` or `#rrggbb`. */
function channels(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Not an opaque hex colour: ${hex}`);
  const digits = match[1]!;
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join("") : digits;
  const channel = (at: number) => Number.parseInt(full.slice(at, at + 2), 16) / 255;
  return [channel(0), channel(2), channel(4)];
}

/** WCAG 2 relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio, from 1 to 21. */
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

it("measures contrast as WCAG does", () => {
  expect(contrast("#000", "#fff")).toBeCloseTo(21, 5);
  expect(contrast("#fff", "#fff")).toBe(1);
  expect(contrast("#777", "#ffffff")).toBeCloseTo(4.48, 2);
});

it("both palettes have the same keys", () => {
  expect(Object.keys(dark)).toEqual(Object.keys(light));
});

describe.each(themes)("$name palette", ({ palette, bg, text, grey, accent }) => {
  it("is the palette of decision-90", () => {
    expect(palette.bg).toBe(bg);
    expect(palette.text).toBe(text);
    expect(palette.muted).toBe(grey);
    expect(palette.subtle).toBe(grey);
    expect(palette.accent).toBe(accent);
  });

  it.each(surfaceTokens.flatMap((surface) => textTokens.map((token) => ({ token, surface }))))(
    "$token on $surface is at least 4.5:1",
    ({ token, surface }) => {
      expect(contrast(palette[token], palette[surface])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("the grey is at least 7:1 on the page background", () => {
    expect(contrast(palette.muted, palette.bg)).toBeGreaterThanOrEqual(7);
    expect(contrast(palette.subtle, palette.bg)).toBeGreaterThanOrEqual(7);
  });

  it("text on an amber fill is at least 4.5:1", () => {
    expect(contrast(palette.accentFg, palette.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.accentFg, palette.accentHover)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(
    surfaceTokens.flatMap((surface) => controlBorderTokens.map((token) => ({ token, surface }))),
  )("$token on $surface is at least 3:1", ({ token, surface }) => {
    expect(contrast(palette[token], palette[surface])).toBeGreaterThanOrEqual(3);
  });

  it("amber is never a text colour", () => {
    const amber = new Set<string>(amberTokens.map((token) => palette[token]));
    expect([...amber]).toEqual([accent]);
    for (const token of textTokens) expect(amber.has(palette[token]), token).toBe(false);
  });

  it("uses only black, white, the grey, the hairline, the soft surface and amber", () => {
    const allowed = new Set<string>([
      "#000",
      "#fff",
      grey,
      palette.border,
      palette.sunken,
      accent,
      "transparent",
    ]);
    for (const [token, value] of Object.entries(palette)) {
      expect(allowed.has(value), `${token}: ${value}`).toBe(true);
    }
    // The hairline and the soft surface are greys: equal channels, no hue.
    for (const neutral of [grey, palette.border, palette.sunken]) {
      const [r, g, b] = channels(neutral);
      expect(r === g && g === b, neutral).toBe(true);
    }
  });
});

it("the focus ring uses the text colour", () => {
  expect(focus.ring).toBe("2px solid var(--lm-text)");
});

it("has no rounded corners, shadows or gradients", () => {
  for (const [step, value] of Object.entries(radius)) expect(value, `radius.${step}`).toBe("0px");
  for (const [step, value] of Object.entries(shadow)) {
    expect(value, `shadow.${step}`).toBe("0 0 0 0 transparent");
  }
  for (const [name, value] of Object.entries(gradient)) {
    expect(value, `gradient.${name}`).not.toContain("gradient(");
  }
});
