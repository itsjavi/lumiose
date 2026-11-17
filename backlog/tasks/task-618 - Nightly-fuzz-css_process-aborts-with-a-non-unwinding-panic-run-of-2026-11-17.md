---
id: TASK-618
title: >-
  Nightly fuzz: css_process aborts with a non-unwinding panic (run of
  2026-11-17)
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-11-17T17:37:00Z'
updated_date: '2026-11-17T17:52:00Z'
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
- [x] #2 The cause is identified: Lumiose code in lumiose_css, or the CSS dependency (then reported upstream and guarded, as TASK-600 did for OXC)
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

Lux, later on 2026-11-17 (user: check for an upstream duplicate first, and unblock ourselves with alternative code).
- Upstream: no new issue is needed. The panic is already removed on the main branch of parcel-bundler/lightningcss by #1329 ("Add NonNegative wrapper for numeric values", merged 2026-09-26): `Percentage::parse` now returns an error instead of `unreachable!()`, so the declaration is kept unparsed. It is not in a release yet (we pin 1.0.0-alpha.72); #1329 is the same change that will retire clamp.rs. Closed look-alikes: #1129 and #1044 (fixed by #1131 for min/max with numbers), #626. Nothing was posted upstream.
- Workaround (new module `shield.rs`): the guard alone turned valid CSS such as `scale: abs(-50%)` into LUM3014 and dropped the whole block. Now a declaration whose value panics in the value checks gets a placeholder custom-property name of the same length before Lightning CSS parses the block (a custom property keeps its value as written), and the name is put back after printing. Same length, so positions and source maps do not move. Placeholders avoid anything in the file or in substituted constants. This matches what the upstream fix will do. Remove shield.rs with the Lightning CSS upgrade.
- Limits: a declaration the value checks skip (descriptors in at-rules, vendor-prefixed names, values with an unresolved $ref) is not shielded and still falls back to LUM3014; names shorter than 3 characters cannot be shielded.
- Evidence: test `a_declaration_that_panics_is_kept_as_written` (minified, with and without a source map, with a colliding custom property, two rules); the original 987-byte crash file replays without a panic escaping; `cargo test --workspace`, fmt and clippy pass.
- Still open: the 10 minute css_process fuzz run (AC #3, second half): cargo-fuzz was not run locally, so the next nightly run is the confirmation.
<!-- SECTION:NOTES:END -->
