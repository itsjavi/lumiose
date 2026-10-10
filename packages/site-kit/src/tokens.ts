// Design tokens of the Lumiose websites. Style blocks read them as `$color.text`, `$space.md`,
// `@media (width < $bp.md)`, …; the compiler inlines the values at build time, so no runtime import
// remains. Every text/background pair below meets WCAG AA (body text AAA) in both themes.

/** Light palette. Read only by the base stylesheet, which turns it into theme custom properties. */
export const light = {
  bg: "#fcfcfe",
  surface: "#ffffff",
  sunken: "#f4f4f9",
  text: "#14141f",
  muted: "#50526a",
  subtle: "#62647d",
  border: "#e3e3ee",
  borderStrong: "#8e90a8",
  accent: "#5546ff",
  accentHover: "#4535ea",
  accentFg: "#ffffff",
  accentText: "#4a3af2",
  accentSoft: "#efedff",
  glowA: "#7c6cff",
  glowB: "#ffb547",
  glowText: "#a24b00",
  shadow: "rgb(20 20 50 / 0.08)",
  codeBg: "#f5f5fa",
  codeFg: "#1d1d2c",
  infoFg: "#0a58a6",
  infoBg: "#edf4ff",
  infoBorder: "#b7d3f7",
  warnFg: "#874600",
  warnBg: "#fff5e2",
  warnBorder: "#f1cf8d",
  tipFg: "#0c673c",
  tipBg: "#e9f8ef",
  tipBorder: "#a6dcbd",
  synKeyword: "#7a2fd6",
  synString: "#0e7448",
  synComment: "#62647d",
  synNumber: "#a54a05",
  synTag: "#b5179e",
  synAttr: "#0a62a0",
  synProp: "#b2134f",
  synPunct: "#50526a",
} as const;

/** Dark palette, same keys as {@link light}. */
export const dark = {
  bg: "#0a0a12",
  surface: "#11111b",
  sunken: "#0d0d16",
  text: "#ededf6",
  muted: "#a8aac2",
  subtle: "#9092ac",
  border: "#262637",
  borderStrong: "#5d5f7c",
  accent: "#8f84ff",
  accentHover: "#a69eff",
  accentFg: "#0a0a12",
  accentText: "#a99fff",
  accentSoft: "#1c1940",
  glowA: "#8f84ff",
  glowB: "#ffbf6b",
  glowText: "#ffc36e",
  shadow: "rgb(0 0 0 / 0.5)",
  codeBg: "#10101a",
  codeFg: "#e3e3f0",
  infoFg: "#8fc3ff",
  infoBg: "#0e1b31",
  infoBorder: "#21406b",
  warnFg: "#ffc978",
  warnBg: "#251a07",
  warnBorder: "#5c3f10",
  tipFg: "#7ddfaa",
  tipBg: "#0a2218",
  tipBorder: "#1b4d36",
  synKeyword: "#c5a8ff",
  synString: "#79dfab",
  synComment: "#9092ac",
  synNumber: "#ffbf6b",
  synTag: "#f59ad6",
  synAttr: "#8bcbff",
  synProp: "#ff9cc3",
  synPunct: "#a8aac2",
} as const;

/**
 * Semantic colors: custom properties that follow the active theme (defined by the base stylesheet
 * from {@link light} and {@link dark}). Components use these, never the raw palettes.
 */
export const color = {
  bg: "var(--lm-bg)",
  surface: "var(--lm-surface)",
  sunken: "var(--lm-sunken)",
  text: "var(--lm-text)",
  muted: "var(--lm-muted)",
  subtle: "var(--lm-subtle)",
  border: "var(--lm-border)",
  borderStrong: "var(--lm-border-strong)",
  accent: "var(--lm-accent)",
  accentHover: "var(--lm-accent-hover)",
  accentFg: "var(--lm-accent-fg)",
  accentText: "var(--lm-accent-text)",
  accentSoft: "var(--lm-accent-soft)",
  glowA: "var(--lm-glow-a)",
  glowB: "var(--lm-glow-b)",
  /** The warm end of gradient text: readable on `bg` (AA), unlike `glowB`. */
  glowText: "var(--lm-glow-text)",
  shadow: "var(--lm-shadow)",
  codeBg: "var(--lm-code-bg)",
  codeFg: "var(--lm-code-fg)",
  infoFg: "var(--lm-info-fg)",
  infoBg: "var(--lm-info-bg)",
  infoBorder: "var(--lm-info-border)",
  warnFg: "var(--lm-warn-fg)",
  warnBg: "var(--lm-warn-bg)",
  warnBorder: "var(--lm-warn-border)",
  tipFg: "var(--lm-tip-fg)",
  tipBg: "var(--lm-tip-bg)",
  tipBorder: "var(--lm-tip-border)",
} as const;

/** Syntax colors for highlighted code (the `tok-*` classes of ./highlight.ts). */
export const syntax = {
  keyword: "var(--lm-syn-keyword)",
  string: "var(--lm-syn-string)",
  comment: "var(--lm-syn-comment)",
  number: "var(--lm-syn-number)",
  tag: "var(--lm-syn-tag)",
  attr: "var(--lm-syn-attr)",
  prop: "var(--lm-syn-prop)",
  punct: "var(--lm-syn-punct)",
} as const;

/** The brand gradient: the "light" of Lumiose, for accents, glows and highlights. */
export const gradient = {
  brand: "linear-gradient(120deg, var(--lm-glow-a), var(--lm-glow-b))",
  /** For gradient text (`background-clip: text`): both ends meet AA contrast on `bg`. */
  text: "linear-gradient(100deg, var(--lm-accent-text) 20%, var(--lm-glow-text))",
  glow: "radial-gradient(60% 120% at 50% 0%, color-mix(in oklab, var(--lm-glow-a) 22%, transparent), transparent 70%)",
} as const;

export const font = {
  sans: 'Inter, "Inter Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  mono: 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
} as const;

/** Type scale (font sizes). `display` is fluid, for hero headings. */
export const text = {
  xs: "0.75rem",
  sm: "0.875rem",
  md: "1rem",
  lg: "1.125rem",
  xl: "1.375rem",
  xxl: "1.75rem",
  xxxl: "2.25rem",
  display: "clamp(2.5rem, 1.6rem + 3.6vw, 4.25rem)",
} as const;

export const leading = { tight: 1.15, snug: 1.35, normal: 1.65 } as const;

export const weight = { regular: 400, medium: 500, semibold: 600, bold: 700 } as const;

/** Spacing scale. */
export const space = {
  xxs: "0.25rem",
  xs: "0.5rem",
  sm: "0.75rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  xxl: "3rem",
  xxxl: "4.5rem",
} as const;

export const radius = {
  sm: "6px",
  md: "10px",
  lg: "16px",
  xl: "24px",
  pill: "999px",
} as const;

/** Breakpoints, for `@media (width < $bp.md)` (mobile first: `width >= …` adds layout). */
export const bp = {
  sm: "40rem",
  md: "48rem",
  lg: "64rem",
  xl: "80rem",
} as const;

/** Layout widths and fixed sizes. */
export const layout = {
  page: "76rem",
  prose: "46rem",
  header: "3.75rem",
  gutter: "clamp(1rem, 4vw, 2rem)",
} as const;

export const shadow = {
  sm: "0 1px 2px var(--lm-shadow)",
  md: "0 4px 16px -4px var(--lm-shadow), 0 1px 2px var(--lm-shadow)",
  lg: "0 18px 50px -12px var(--lm-shadow), 0 2px 6px var(--lm-shadow)",
  glow: "0 8px 28px -6px color-mix(in oklab, var(--lm-glow-a) 60%, transparent), 0 4px 18px -8px color-mix(in oklab, var(--lm-glow-b) 70%, transparent)",
} as const;

export const motion = {
  fast: "120ms",
  base: "200ms",
  slow: "360ms",
  ease: "cubic-bezier(0.2, 0.7, 0.2, 1)",
} as const;

export const z = { header: 40, menu: 50 } as const;

/** The focus ring, shared by every interactive element. */
export const focus = {
  ring: "2px solid var(--lm-accent)",
  offset: "2px",
} as const;
