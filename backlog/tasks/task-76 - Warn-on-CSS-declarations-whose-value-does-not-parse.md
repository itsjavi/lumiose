---
id: TASK-76
title: Warn on CSS declarations whose value does not parse
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-08 16:37'
updated_date: '2026-10-08 21:16'
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
- [x] #1 lumen_css reports a warning (LUM3015 or a new registered code) for a declaration of a known property whose value does not parse and contains no var()/env()/attr(), with the property and value in the message
- [x] #2 No warning for valid values, custom properties or vendor-prefixed properties Lightning CSS does not know; tests in crates/lumen_css
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Per the RESUME design: (1) prepass: Context::Descriptors for non-group, non-keyframes at-rule blocks (Declaration.descriptor) and record declarations directly inside group rules nested in style rules; (2) new src/values.rs called from process::prepare() with the ref substitutions: LUM3019 detached unit, LUM3018 unitless numeric ref (px/deg/ms probes: invalid->valid, Lightning px conversion, number/dimension mix or number-only reduction in a math function), LUM3017 Unparsed values behind conservative filters + grid auto-repeat TrackList check; (3) CssCode InvalidCssValue/UnitlessStyleRef/DetachedUnit (warnings); (4) unit tests, corpus integration test (tests/values.rs + tests/values/{valid,invalid}.txt), golden fixture tests/fixtures/values.stsx; clippy; follow-up tasks for registry (Photon) and docs (Beacon).
<!-- SECTION:PLAN:END -->

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

IMPLEMENTED (Halo, 2026-10-08, session halo-20261008T203613Z). Files: crates/lumen_css/src/values.rs (new), prepass.rs (Context::Descriptors + Declaration.descriptor; declarations directly inside group rules nested in style rules are now recorded, so the negative-math clamp covers them too), process.rs (prepare() builds Substitutions and calls values::check before clamp; value_text pub(crate)), diagnostics.rs (InvalidCssValue=LUM3017, UnitlessStyleRef=LUM3018, DetachedUnit=LUM3019, all Warning), lib.rs (docs), clamp.rs (nested @media test). Tests: values.rs unit tests (8), tests/values.rs corpus test (tests/values/valid.txt = 1105 valid declarations from the probe corpora, none warns; tests/values/invalid.txt = 47 invalid ones, each exactly one LUM3017), golden fixture tests/fixtures/values.stsx/.out (messages, help, fixes). Deviations from the design: math functions are NOT in the LUM3017 known-function set (Lightning keeps valid z-index: calc(3 * 2) as raw tokens; math.stsx caught it); LUM3018 also fires when a math function reduces to a bare number in a length position (width: calc($a * $b) prints '8'); one LUM3018 per math function. Corpus check found clip-path: border-box padding-box (in my valid corpus) is actually invalid -> moved to invalid.txt. Repo scan of all 127 tracked .stsx files (refs unresolved): one hit, a true positive in the user's uncommitted examples/spa-chiptune/src/ui/App.stsx ('border: 2px <word> solid'). Known conservative misses: unknown function names (blurr()), unknown properties (object-fit is unknown to Lightning alpha.72), Unparsed values containing math, literal unitless lengths (gap: 8, Lightning converts them to px so output is valid). Follow-ups: TASK-81 (Photon: register LUM3017-3019 in lumen_compiler registry; until then convert() drops them), TASK-82 (Beacon: error docs + llms). Validation: cargo test -p lumen_css (all suites) and cargo test -p lumen_compiler pass; cargo clippy -p lumen_css --all-targets: 0 warnings; cargo fmt -p lumen_css --check clean. Probe test removed from crates (copy remains in .local/agents/Halo/halo-task76-20261008T164216Z/).

Photon (2026-10-08, FYI, not blocking): with the current lumen_css WIP built into the binding, compiling packages/language-server/src/__fixtures__/workspace/src/components/Broken.stsx panics: 'byte range starts at 73 but ends at 72' at crates/lumen_css/src/values.rs:226:27 (aborts the Node process through napi). Repro: node -e with @lumen/compiler compile(readFileSync(file), '/'+file, { root: '/' }).

Halo, 2026-10-08 (post-Done fix, reported by Lux): values::value_range sliced start..end with start > end for a whitespace-only value ('color: ;'), aborting the napi process and the language server (18 LSP tests: 'Connection is closed'). Fixed (empty values return None; the CSS language service already reports them in editors, so no LUM3017 for them). Regression: values::tests::skips_empty_values, fixture tests/fixtures/malformed.stsx, and tests/robustness.rs (every prefix of every fixture block plus 14 malformed snippets x 13 insertions at every position, refs resolved, catch_unwind: no panics). Verified: pnpm build:compiler + compile of packages/language-server/src/__fixtures__/workspace/src/components/Broken.stsx OK; pnpm vitest run packages/language-server 53/53; cargo test -p lumen_css all suites; clippy 0. pnpm test: 920 passed, 1 failed = docs.test.ts stale llms.txt from other agents' uncommitted packages/lumen/docs edits (not lumen_css). Committed fec22aa (crates/lumen_css).
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Beacon
created: 2026-10-08 20:58
---
Beacon (2026-10-08 ~23:00): the working-tree lumen_css (uncommitted crates/lumen_css/src/values.rs) panics on an empty declaration value and aborts the process: compile(`<div><style>.oops { color: ; }</style></div>`) → 'byte range starts at 15 but ends at 14' at crates/lumen_css/src/values.rs:226. It kills the language server on packages/language-server fixture Broken.stsx (all server.test.ts tests fail with the current shared binding).
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen_css now warns about declaration values browsers would drop. LUM3017 (invalid CSS value): values Lightning CSS keeps as raw tokens, behind conservative filters (CSS-wide keywords, var/env/attr, unknown or math functions, gradients with 'in <space>', vendor idents, a newer-keyword list, known (property, keyword) gaps, three unchecked properties), plus a typed grid check for repeat(auto-fill|auto-fit) with non-fixed tracks (the site-kit footer case). LUM3018/LUM3019 cover TASK-67. At-rule descriptors, custom/vendor/unknown properties and values with unresolved refs are skipped. Output CSS is unchanged. Tests: unit tests, a 1105-line valid corpus (no warnings) and 47-line invalid corpus (one warning each), golden fixture values.stsx. Codes need registry entries (TASK-81, Photon) and docs (TASK-82, Beacon).
<!-- SECTION:FINAL_SUMMARY:END -->
