---
id: TASK-618
title: >-
  Nightly fuzz: css_process aborts with a non-unwinding panic (run of
  2026-11-17)
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-11-17T17:37:00Z'
updated_date: '2026-11-17T17:44:00Z'
labels: []
dependencies: []
references:
  - https://github.com/itsjavi/lumiose/actions/runs/44079590552
ordinal: 610000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The scheduled Fuzz run of 2026-11-17 (commit e2ca19d4, before the redesign commits) failed in the css_process target after about 133,000 executions: "thread caused non-unwinding panic. aborting", libFuzzer deadly signal, exit status 77. The log has no panic message. The input is in the run artifact fuzz-crash-css_process (crash-06df1645a8bbe4fd779aa1ce6d857ce5ad8ecbc6, 439 bytes). TASK-599 fixed an earlier css_process panic; this is a new input.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The crash is reproduced locally from the artifact and minimised
- [ ] #2 The cause is identified: Lumiose code in lumiose_css, or the CSS dependency (then reported upstream and guarded, as TASK-600 did for OXC)
- [ ] #3 The input is added to the fuzz corpus or a regression test, and the css_process target passes a 10 minute run
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (solo takeover of a Halo crate), 2026-11-17.
- Reproduced from the run artifact with a temporary replay test (the fuzz target body, on the stable toolchain). Minimal input: `.a { scale: abs(-50%) }`.
- Cause, in two parts. (1) Lightning CSS 1.0.0-alpha.72, `Percentage::parse` (src/values/percentage.rs:30): it parses a `Calc` and treats anything that is not a plain value as `unreachable!()`, but `abs(-50%)` stays a math function. The same arm as TASK-599. (2) Ours: the value checks in lumiose_css (`values.rs`, and the calc parse in `fold.rs`) call `Property::parse_string` and `Calc::parse_string` before the stylesheet is parsed, outside the `guarded` catch that TASK-599 added around `StyleSheet::parse`. So the panic escaped `process`; under libFuzzer it crossed the C entry point, hence "non-unwinding panic".
- Fix: those five calls go through `guarded` (a panic reads as "does not parse"); the guarded stylesheet parse then reports the block as LUM3014. Regression test `a_panic_in_the_value_checks_does_not_escape` in tests/robustness.rs. The fuzz corpus is git-ignored and seeded from fixtures, so the test is the durable record.
- Checks: the artifact input now finishes with diagnostics; `cargo test -p lumiose_css`, `cargo fmt --check` and clippy pass.
- Not done: the 10 minute css_process fuzz run (cargo-fuzz was not run locally; the next nightly run covers it), and the upstream report, which needs the user OK before posting in another project.
<!-- SECTION:NOTES:END -->
