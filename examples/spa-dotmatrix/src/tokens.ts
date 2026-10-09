// Design tokens, read by style blocks as `$tokens.…` and inlined at build time. Colors become CSS
// custom properties in the root layout's global block (one set per theme), so the theme and the
// screen palette switch at runtime.
export const tokens = {
  font: {
    pixel: `"Silkscreen", ui-monospace, monospace`,
    body: `"Space Grotesk Variable", "Space Grotesk", system-ui, sans-serif`,
  },
  radius: { sm: "6px", md: "12px", lg: "22px", shell: "18px 18px 56px 18px" },
  /** The console shell, in the light and dark themes. */
  light: {
    page: "#cfcabd",
    shell: "#e9e5db",
    shellLow: "#dcd7cb",
    edge: "#b7b0a1",
    ink: "#26243a",
    dim: "#625e74",
    accent: "#a3205a",
    accentInk: "#ffffff",
    indigo: "#3d3a8c",
    bezel: "#56566a",
    groove: "#c5bfb1",
  },
  dark: {
    page: "#121118",
    shell: "#1f1e28",
    shellLow: "#191820",
    edge: "#363445",
    ink: "#eceaf4",
    dim: "#a19eb6",
    accent: "#e2508d",
    accentInk: "#1a0c13",
    indigo: "#9a96ff",
    bezel: "#0c0c12",
    groove: "#2b2a36",
  },
  /** Screen palettes: four shades, lightest to darkest, as on a dot-matrix LCD. */
  lcd: {
    pea: { l0: "#c5cea0", l1: "#8d9a6b", l2: "#4f5a3e", l3: "#1e2419" },
    pocket: { l0: "#e0f0c8", l1: "#8fbf78", l2: "#3c6b58", l3: "#0d1c22" },
    dusk: { l0: "#f6e2c6", l1: "#d08e7b", l2: "#6e4e6f", l3: "#291a33" },
    ice: { l0: "#e2f0f6", l1: "#93bad6", l2: "#406c9b", l3: "#13223a" },
  },
  /** One color per channel, used outside the screen. */
  channel: { p1: "#d0336f", p2: "#e0812a", wave: "#1c9b8c", noise: "#6460d6" },
} as const;

export const CHANNEL_COLORS = [
  tokens.channel.p1,
  tokens.channel.p2,
  tokens.channel.wave,
  tokens.channel.noise,
] as const;
