---
id: TASK-81
title: Register LUM3017-LUM3019 in the compiler diagnostics registry
status: Done
assignee:
  - Photon
created_date: '2026-10-08 20:48'
updated_date: '2026-10-08 21:09'
labels: []
milestone: m-1
dependencies: []
references:
  - crates/lumen_css/src/values.rs
  - crates/lumen_css/tests/fixtures/values.out
priority: medium
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lumen_css now emits three warnings (TASK-76, TASK-67): LUM3017 invalid CSS value, LUM3018 unitless number from a $ reference, LUM3019 unit separated from a $ reference (CssCode::InvalidCssValue / UnitlessStyleRef / DetachedUnit in crates/lumen_css/src/diagnostics.rs). lumen_compiler's css::convert() drops codes missing from crates/lumen_compiler/src/diagnostics/registry.rs, so they never reach users until registered. Small, additive.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 registry.rs has, after LUM3016: InvalidCssValue = "LUM3017", Warning, "Invalid CSS value"; UnitlessStyleRef = "LUM3018", Warning, "Unitless number from a `$` reference"; DetachedUnit = "LUM3019", Warning, "Unit separated from a `$` reference"
- [x] #2 A compiler test shows each code converted from lumen_css (span, help and fix preserved); compiler golden fixtures re-reviewed (UPDATE only after reviewing diffs); cargo test --workspace passes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Register LUM3017-3019 after LUM3016 in crates/lumen_compiler/src/diagnostics/registry.rs (Warning, titles per AC#1).
2. Registry unit test for the three codes. Per Lux, no committed test may depend on Halo's uncommitted lumen_css WIP: the end-to-end conversion through compile() is verified locally against the WIP and recorded here; the committed conversion test lands with Halo's lumen_css commit.
3. Regenerate error docs (gen-error-docs.ts) and hand-write LUM3017/3018/3019 explanations (TASK-82 AC#1, at Lux's request); docs:gen + docs:check + docs tests.
4. cargo test/clippy/fmt; commit registry + docs pages.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-08): registry entries + unit test (css_value_warnings_are_registered) committed in 0a0e469, together with hand-written docs/errors/LUM3017-3019.md, errors README and llms regenerated (TASK-82 AC#1, at Lux's request). Per Lux, no committed test depends on Halo's uncommitted lumen_css WIP, so two pieces stay UNCOMMITTED in the working tree and must be committed WITH Halo's lumen_css change (TASK-76/67): (a) crates/lumen_compiler/tests/css_value_warnings.rs: compile() on an .stsx converts LUM3017/3018/3019 with .stsx spans, help and fix ($gap -> calc($gap * 1px), $angle -> calc($angle * 1deg), '$gap px' -> calc($gap * 1px)); passes against the WIP; (b) goldens client/style-constants.{js,server.js} and client/styles.{js,server.js} gain one LUM3018 line each ($tokens.radius.sm = 2 / $radius.lg = 8 in border-radius); reviewed: true positives (the test tokens are unitless numbers), updated with UPDATE_GOLDEN=1. At HEAD (without the WIP) lumen_css emits none of these codes, so committed goldens stay correct. Validation: cargo test --workspace green with the WIP + (a)+(b); cargo clippy -p lumen_compiler --all-targets 0 warnings; cargo fmt check clean (lumen_compiler); docs:gen/docs:check OK; vitest packages/lumen/src/cli 60/60.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Registered LUM3017 (Invalid CSS value), LUM3018 (Unitless number from a `$` reference) and LUM3019 (Unit separated from a `$` reference) as warnings after LUM3016, so css::convert() passes lumen_css's value warnings through to compile(), lumen check and the language server. Hand-written error pages, README and llms regenerated. The end-to-end conversion test and the four golden diffs it causes are in the working tree, to be committed with Halo's lumen_css change (see notes).
<!-- SECTION:FINAL_SUMMARY:END -->
