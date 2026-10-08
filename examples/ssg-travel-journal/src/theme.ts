// Design tokens. Style blocks read them as `$theme.*` (`import * as theme from "../theme.ts"`);
// the compiler inlines the values at build time, so this module never ships to the browser.
// Colors use `light-dark()`: the root `color-scheme` (system, or the theme toggle's choice)
// picks the light or dark value.

export const color = {
  paper: "light-dark(#fbf7f0, #14151a)",
  card: "light-dark(#ffffff, #1c1d24)",
  ink: "light-dark(#24211c, #ebe6dd)",
  muted: "light-dark(#6d665b, #a39c90)",
  accent: "light-dark(#b0441b, #f0915f)",
  accentInk: "light-dark(#ffffff, #1a1109)",
  line: "light-dark(#e7dfd2, #2c2d35)",
  chip: "light-dark(#f2ebe0, #25262f)",
  chipHover: "light-dark(#e9dfcf, #30313c)",
  mark: "light-dark(#fde8c8, #4a3420)",
} as const;

export const font = {
  body: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  display: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
  small: "0.875rem",
  tiny: "0.78rem",
  lead: "1.2rem",
  h1: "clamp(2.1rem, 1.5rem + 2.4vw, 3.2rem)",
  h2: "clamp(1.5rem, 1.25rem + 1vw, 1.9rem)",
} as const;

export const space = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2.5rem",
  xxl: "4rem",
} as const;

export const radius = {
  sm: "6px",
  md: "12px",
  lg: "18px",
  pill: "999px",
} as const;

export const layout = {
  page: "72rem",
  prose: "42rem",
  /** Below this width, the header wraps and the post grid becomes one column. */
  narrow: "44rem",
} as const;

export const shadow = {
  card: "0 1px 2px rgb(0 0 0 / 0.06), 0 6px 20px rgb(0 0 0 / 0.07)",
  lift: "0 2px 4px rgb(0 0 0 / 0.08), 0 14px 34px rgb(0 0 0 / 0.12)",
  popup: "0 10px 40px rgb(0 0 0 / 0.22)",
} as const;

export const motion = {
  fast: "140ms",
  ease: "cubic-bezier(0.2, 0.7, 0.2, 1)",
} as const;
