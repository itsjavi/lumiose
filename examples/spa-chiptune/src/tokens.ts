// Design tokens, read by style blocks as `$tokens.…` and inlined at build time. Colors become CSS
// custom properties in App.stsx's global block (one set per theme), so the theme can switch at
// runtime; sizes are used directly.
export const tokens = {
  font: {
    mono: `ui-monospace, "SF Mono", "JetBrains Mono", "Cascadia Mono", Menlo, Consolas, monospace`,
    size: "13px",
    grid: "14px",
  },
  space: 4,
  /** Pattern grid row height in px. */
  row: 18,
  border: 2,
  shadow: "3px 3px 0 0 #000",
  /** Palettes: colors from the NES PPU palette, and the four greens of the original Game Boy. */
  nes: {
    bg: "#0c0c1e",
    panel: "#16163a",
    raised: "#24245a",
    line: "#3c3c7c",
    text: "#f0f0ff",
    dim: "#7c7cb0",
    faint: "#2e2e62",
    light: "#5c5cb4",
    yellow: "#f8d878",
    cyan: "#3cbcfc",
    green: "#58d854",
    pink: "#f878f8",
    orange: "#fca044",
    red: "#f83800",
    blue: "#0058f8",
  },
  dmg: {
    bg: "#0f380f",
    panel: "#1b461b",
    raised: "#306230",
    line: "#4c7a1c",
    text: "#c4e070",
    dim: "#7aa030",
    faint: "#24521c",
    light: "#6a9a2a",
    yellow: "#e0f8a0",
    cyan: "#9bbc0f",
    green: "#b8d838",
    pink: "#d0f070",
    orange: "#a8c848",
    red: "#e0f8a0",
    blue: "#306230",
  },
} as const;
