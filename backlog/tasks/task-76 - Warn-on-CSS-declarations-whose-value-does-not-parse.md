---
id: TASK-76
title: Warn on CSS declarations whose value does not parse
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-08 16:37'
updated_date: '2026-10-08 16:53'
labels: []
milestone: m-5
dependencies: []
priority: low
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while building @lumen/site-kit (TASK-59): 'grid-template-columns: 2fr repeat(auto-fit, minmax(9rem, 1fr))' (invalid: an auto-repeat cannot be combined with flexible tracks) compiled without a diagnostic, and the browser dropped it. lumen_css keeps values of known properties that Lightning CSS cannot parse as unparsed tokens (also 'color: notacolor', 'width: 10 px'), so typos reach the browser silently. LUM3015 currently covers dropped selectors only. Related: TASK-67 (the '$gap px' case is one instance).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen_css reports a warning (LUM3015 or a new registered code) for a declaration of a known property whose value does not parse and contains no var()/env()/attr(), with the property and value in the message
- [ ] #2 No warning for valid values, custom properties or vendor-prefixed properties Lightning CSS does not know; tests in crates/lumen_css
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
RESUME (Halo, 2026-10-08, checkpoint requested by Lux). No source files changed; lumen_css untouched (tests as before). Probe test + corpora moved to .local/agents/Halo/halo-task76-20261008T164216Z/ (zz_probe_halo.rs: copy to crates/lumen_css/tests/, run `PROBE=<corpus> [ALL=1] cargo test -p lumen_css --test zz_probe_halo -- --nocapture`; delete after).

Findings (pinned lightningcss 1.0.0-alpha.72):
- Property::parse falls back to Property::Unparsed for any known property whose typed parse fails (catches `color: notacolor`, `width: 10 px`, `display: flexbox`, `padding: none`, `rotate: 45`, `transition: opacity 200`, `font: 16/1.5 serif`).
- BUT the motivating grid case `2fr repeat(auto-fit, minmax(9rem, 1fr))` parses as TYPED (Lightning does not enforce the auto-repeat rule) -> needs a dedicated TrackList check: with an auto-fill/auto-fit repeat, every other track (and the repeat's own tracks) must be <fixed-size> (length-percentage, or minmax with a fixed min or fixed max); only one auto-repeat; minmax min cannot be fr. Apply to grid-template-columns/rows, grid-template, grid.
- Lightning accepts unitless numbers as px in length positions (`gap: 8` -> `8px`, `margin: 0 8`, `translateX(10)`, `blur(2)`), keeps `calc(8 + 1px)` / `min(100%, 600)` as typed-but-invalid calc, and does NOT accept unitless angles/times (`rotate: 45`, `hue-rotate(45)`, `transition-duration: 2` -> Unparsed). stroke-width/stroke-dashoffset unitless -> px (valid SVG; exclude from LUM3018).
- Valid CSS Lightning keeps Unparsed (false-positive sources): CSS-wide keywords (inherit/initial/unset/revert/revert-layer); `! important` with a space; box-shadow/text-shadow `none`; animation-duration `auto`; outline-color `invert`; font system keywords (caption/menu/status-bar…); flex-basis content/fit-content/max-content; transform-origin `50% 50% 0`; text-overflow strings/two values; image-rendering (all but auto); grid-auto-flow `dense`; transform-style `preserve-3d`; display `math`/`grid-lanes`; justify-items `legacy`; overflow `overlay`; text-transform `math-auto`; background-clip `border-area`; word-break `auto-phrase`; font-size `math`; subgrid/masonry; anchor-center; allow-discrete; gradients with `in <space>`; color-mix without method; linear() easing; anchor()/anchor-size()/calc-size()/if()/attr()/random()/sibling-index()/progress()/contrast-color()/shape()/xywh()/rect()/path()/paint()/element()/cross-fade(); image-set() in cursor; `-webkit-*` idents.

Design (agreed plan, not yet coded):
1. prepass.rs: add `descriptor: bool` to Declaration via a new Context::Descriptors for non-group, non-keyframes at-rule blocks (@font-face, @page, @property, @counter-style, @position-try…) -> skip checks there (`font-weight: 100 900` in @font-face is valid). Also record declarations directly inside nested group rules (Context::Rules{nested:true}); clamp benefits too (add test).
2. New src/values.rs, called from process::prepare() with the ref substitutions (before clamp edits): per declaration (skip descriptor, `--*`, vendor-prefixed names, PropertyId::Custom/All, values with unresolved/hyphenated refs, a `!` other than a trailing `!\s*important`), build substituted text and Property::parse_string:
   - LUM3019 (warning, "Unit separated from a `$` reference"): resolved numeric ref (Number or numeric String) followed by whitespace + unit ident or `%` (exclude `in`, `x`) -> span `$gap px`, fix `calc($gap * 1px)`.
   - LUM3018 (warning, "Unitless number from a `$` reference"): non-zero numeric ref i; for unit in [px, deg, ms]: P_i = parse with that ref + unit; hit if P_i typed AND (P0 Unparsed/Err OR print(P0)==print(P_i) [Lightning px conversion] OR enclosing math fn: fold::evaluate(with n) None && evaluate(with n+unit) Some). Fix calc($x * 1px|1deg); time: help only (ms or s). Exclude stroke-width/stroke-dashoffset.
   - LUM3017 (warning, "Invalid CSS value"): when no 3018/3019 on the declaration: P0 Unparsed and conservative filters on its TokenList (skip if not a lone CSS-wide keyword check fails, any Var/Env/UnresolvedColor/DashedIdent, any Function not in a known-good set [math fns, rgb/hsl/hwb/lab/lch/oklab/oklch/color/light-dark, url, repeat/minmax/fit-content, transform fns, cubic-bezier/steps, filter fns, inset/circle/ellipse/polygon, counter(s), gradients], vendor-prefixed idents, newer keywords list, (property, keyword) gaps: box-shadow/text-shadow none, animation(-duration) auto, outline(-color) invert; skipped properties text-overflow, transform-origin, image-rendering), plus the grid auto-repeat check on typed values. Message names property + (substituted) value; span = trimmed value without !important.
3. diagnostics.rs: CssCode::{InvalidCssValue = LUM3017, UnitlessStyleRef = LUM3018, DetachedUnit = LUM3019}, all Warning. Compiler `convert()` drops unknown ids, so Photon must add them to crates/lumen_compiler/src/diagnostics/registry.rs (3xxx block, after LUM3016); Beacon to add docs pages (packages/lumen/docs/errors/LUM3017-3019.md) + llms.
4. Tests: unit tests in values.rs (valid corpus produces nothing; invalid list warns), new fixture tests/fixtures/values.stsx(+.out); re-run all fixtures (UPDATE_FIXTURES=1 only after reviewing diffs); cargo clippy -p lumen_css.
TASK-67 is folded into the same module (LUM3018/3019); TASK-70 study not started.
<!-- SECTION:NOTES:END -->
