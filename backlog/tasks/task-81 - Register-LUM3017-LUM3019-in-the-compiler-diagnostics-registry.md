---
id: TASK-81
title: Register LUM3017-LUM3019 in the compiler diagnostics registry
status: To Do
assignee:
  - Photon
created_date: '2026-10-08 20:48'
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
- [ ] #1 registry.rs has, after LUM3016: InvalidCssValue = "LUM3017", Warning, "Invalid CSS value"; UnitlessStyleRef = "LUM3018", Warning, "Unitless number from a `$` reference"; DetachedUnit = "LUM3019", Warning, "Unit separated from a `$` reference"
- [ ] #2 A compiler test shows each code converted from lumen_css (span, help and fix preserved); compiler golden fixtures re-reviewed (UPDATE only after reviewing diffs); cargo test --workspace passes
<!-- AC:END -->
