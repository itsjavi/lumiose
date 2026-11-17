// Design tokens of the Lumiose websites. Style blocks read them as `$color.text`, `$space.md`,
// `@media (width < $bp.md)`, …; the compiler inlines the values at build time, so no runtime import
// remains.
//
// The identity (decision-90) is black and white, one grey for secondary text, a hairline grey and a
// soft-surface grey, and one amber accent. Amber is decoration only (beams, the logo, the marker of
// the active item, emphasis in code): never a text colour and never a focus ring. Corners are
// square; there are no shadows and no gradients. tokens.test.ts checks the contrast of every
// text/surface pair in both themes.

// Each palette is a literal object (the compiler inlines only literals), built from six values: the
// background, the text colour, the grey (secondary text and control borders: 7:1 on the background),
// the hairline, the soft surface and the amber accent.
//
// - `surface` is the background: cards and panels are set apart by a hairline, not a fill.
// - `accentText`, `glowText` and every callout and code colour are the text colour or the grey.
//   Callouts are told apart by their icon and label, and code highlighting is monochrome.
// - `accentFg`, the text on an amber fill, is black in both themes.

/** Light palette. Read only by the base stylesheet, which turns it into theme custom properties. */
export const light = {
  bg: "#fff",
  surface: "#fff",
  sunken: "#f6f6f6",
  text: "#000",
  muted: "#595959",
  subtle: "#595959",
  border: "#e2e2e2",
  borderStrong: "#595959",
  accent: "#f5a300",
  accentHover: "#f5a300",
  accentFg: "#000",
  accentText: "#000",
  accentSoft: "#f6f6f6",
  glowA: "#f5a300",
  glowB: "#f5a300",
  glowText: "#000",
  shadow: "transparent",
  codeBg: "#f6f6f6",
  codeFg: "#000",
  inlineCodeFg: "#000",
  inlineCodeBorder: "#e2e2e2",
  infoFg: "#000",
  infoBg: "#f6f6f6",
  infoBorder: "#e2e2e2",
  warnFg: "#000",
  warnBg: "#f6f6f6",
  warnBorder: "#e2e2e2",
  tipFg: "#000",
  tipBg: "#f6f6f6",
  tipBorder: "#e2e2e2",
  synKeyword: "#000",
  synString: "#000",
  synComment: "#595959",
  synNumber: "#000",
  synTag: "#000",
  synAttr: "#000",
  synProp: "#000",
  synPunct: "#595959",
} as const;

/** Dark palette, same keys as {@link light}. */
export const dark = {
  bg: "#000",
  surface: "#000",
  sunken: "#0d0d0d",
  text: "#fff",
  muted: "#a3a3a3",
  subtle: "#a3a3a3",
  border: "#262626",
  borderStrong: "#a3a3a3",
  accent: "#ffd27a",
  accentHover: "#ffd27a",
  accentFg: "#000",
  accentText: "#fff",
  accentSoft: "#0d0d0d",
  glowA: "#ffd27a",
  glowB: "#ffd27a",
  glowText: "#fff",
  shadow: "transparent",
  codeBg: "#0d0d0d",
  codeFg: "#fff",
  inlineCodeFg: "#fff",
  inlineCodeBorder: "#262626",
  infoFg: "#fff",
  infoBg: "#0d0d0d",
  infoBorder: "#262626",
  warnFg: "#fff",
  warnBg: "#0d0d0d",
  warnBorder: "#262626",
  tipFg: "#fff",
  tipBg: "#0d0d0d",
  tipBorder: "#262626",
  synKeyword: "#fff",
  synString: "#fff",
  synComment: "#a3a3a3",
  synNumber: "#fff",
  synTag: "#fff",
  synAttr: "#fff",
  synProp: "#fff",
  synPunct: "#a3a3a3",
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
  /** The text colour (it was the readable end of gradient text). */
  glowText: "var(--lm-glow-text)",
  shadow: "var(--lm-shadow)",
  codeBg: "var(--lm-code-bg)",
  codeFg: "var(--lm-code-fg)",
  /** Inline code in running text: a chip on the soft surface, apart from body text. */
  inlineCodeFg: "var(--lm-inline-code-fg)",
  inlineCodeBg: "var(--lm-inline-code-bg)",
  inlineCodeBorder: "var(--lm-inline-code-border)",
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

/**
 * Flat colours since decision-90, which has no gradients. The names stay for the components and
 * pages that still read them, each as a `background` value; new code uses {@link color}.
 */
export const gradient = {
  brand: "var(--lm-accent)",
  text: "var(--lm-text)",
  glow: "transparent",
} as const;

export const font = {
  sans: '"Helvetica Neue", Helvetica, ui-sans-serif, system-ui, Arial, sans-serif',
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
} as const;

/** Small labels (eyebrows, navigation, table heads): {@link font}'s mono stack, uppercase, widely spaced. */
export const label = {
  font: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
  size: "0.6875rem",
  tracking: "0.14em",
  transform: "uppercase",
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

/** Square corners everywhere: every step is 0. The steps stay for the code that reads them. */
export const radius = {
  sm: "0px",
  md: "0px",
  lg: "0px",
  xl: "0px",
  pill: "0px",
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

/**
 * No shadows. Each step is a zero-size transparent shadow rather than `none`, which is not valid
 * inside a comma-separated `box-shadow` list.
 */
export const shadow = {
  sm: "0 0 0 0 transparent",
  md: "0 0 0 0 transparent",
  lg: "0 0 0 0 transparent",
  glow: "0 0 0 0 transparent",
} as const;

export const motion = {
  fast: "120ms",
  base: "200ms",
  slow: "360ms",
  ease: "cubic-bezier(0.2, 0.7, 0.2, 1)",
} as const;

export const z = { header: 40, menu: 50 } as const;

/**
 * The focus ring, shared by every interactive element. It uses the text colour: amber on white is
 * about 2:1, below the 3:1 a focus ring needs.
 */
export const focus = {
  ring: "2px solid var(--lm-text)",
  offset: "3px",
} as const;
