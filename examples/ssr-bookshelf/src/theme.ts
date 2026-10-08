// Design tokens. Style blocks read them as `$theme.*` (`import * as theme from "../theme.ts"`);
// the compiler inlines the values at build time, so this module never ships to the browser.
// Colors mix with `currentColor`, so they work in both light and dark color schemes.

export const color = {
  accent: "#b4451f",
  accentInk: "#ffffff",
  star: "#e0a100",
  /** Unlit stars: a fixed gray, since star glyphs are painted with `color: transparent`. */
  starOff: "rgb(128 128 128 / 0.35)",
  danger: "#c62828",
  success: "#2e7d32",
  muted: "color-mix(in srgb, currentColor 62%, transparent)",
  line: "color-mix(in srgb, currentColor 15%, transparent)",
  surface: "color-mix(in srgb, currentColor 5%, transparent)",
  hover: "color-mix(in srgb, currentColor 9%, transparent)",
} as const;

export const space = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2.5rem",
} as const;

export const radius = {
  sm: "4px",
  md: "8px",
  pill: "999px",
} as const;

export const font = {
  small: "0.875rem",
  lead: "1.125rem",
  title: "2rem",
} as const;

export const layout = {
  page: "68rem",
  form: "28rem",
  /** Below this width, two-column layouts stack. */
  narrow: "44rem",
} as const;

export const shadow = {
  card: "0 1px 2px rgb(0 0 0 / 0.14), 0 4px 12px rgb(0 0 0 / 0.08)",
  popup: "0 4px 24px rgb(0 0 0 / 0.18)",
} as const;
