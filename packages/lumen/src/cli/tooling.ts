// `lumen/tooling`: build-time tooling API for editor/CLI integrations (owner: Beacon).
// Not part of the runtime; used by @lumen/language-server and future integrations.
export * from "./check/index.ts";
export { syncShadows } from "./check/shadow.ts";
export {
  fmt,
  formatStsx,
  type FmtFileResult,
  type FmtOptions,
  type FormatConfig,
  type Formatter,
  type FormatStsxResult,
} from "./fmt/index.ts";
export { lint, type LintOptions, type LintResult, type Stylelint } from "./lint/index.ts";
export { protectRefs, refIdentifier, virtualCss } from "./style-css.ts";
