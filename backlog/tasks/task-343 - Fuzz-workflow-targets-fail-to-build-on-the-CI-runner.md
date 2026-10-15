---
id: TASK-343
title: 'Fuzz workflow: targets fail to build on the CI runner'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 08:02'
updated_date: '2026-10-15 11:56'
labels:
  - security
  - fuzzing
  - ci
milestone: m-11
dependencies: []
priority: high
ordinal: 345000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the first manual run of the nightly fuzz workflow (TASK-311, https://github.com/itsjavi/lumiose/actions/runs/38700307868). Every fuzz target job fails while building: cargo fuzz on nightly Rust targets x86_64-unknown-linux-musl, whose standard library is not installed ("can't find crate for core", E0463), so no target ran. Make the fuzz jobs build and run on the runner (install the target, or build for the host target), keeping AddressSanitizer, and confirm with one manual run of the workflow after the fix is pushed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every fuzz target builds and runs for its time budget in the workflow
- [x] #2 One manual run after the fix passes, or its findings are tracked as tasks
- [x] #3 CONTRIBUTING.md's Fuzzing section stays accurate
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Halo): claimed in worktree branch claude/halo-m11-ec4bcd. Photon's area (.github/workflows/fuzz.yml, fuzz/**); the orchestrator allowed it for this task (no Photon worker active).

2026-10-15 (Halo): cause: cargo-fuzz defaults --target to the triple it was itself built for (utils::default_target() = current_platform::CURRENT_PLATFORM). taiki-e/install-action installs the upstream prebuilt binary, which only exists as x86_64-unknown-linux-musl, so every build targeted musl: no std installed for it (E0463), and "sanitizer is incompatible with statically linked libc".
Fix (.github/workflows/fuzz.yml): the nightly step exports FUZZ_TRIPLE, the runner's own target from `rustc +nightly -vV` (x86_64-unknown-linux-gnu on ubuntu-latest), and the fuzz step passes `--target "$FUZZ_TRIPLE" --sanitizer address` (address is the default; explicit now). No change to fuzz/**. actionlint clean.
Local reproduction (ubuntu:22.04 arm64 container, nightly, cargo-fuzz 0.13.2 from source, the workflow's commands): with --target aarch64-unknown-linux-musl the build fails with the CI errors (E0463 for core, sanitizer incompatible with static libc); with --target "$FUZZ_TRIPLE" --sanitizer address after fuzz/seed.sh, all 7 targets build and run 30 s each with exit 0 and the ASan runtime linked (__asan_init in each binary): scan 72599 runs, compile_client 29034, compile_server 30710, css_process 19270, svg_component 683134, content_markdown 5541, content_html 96591. No crashes. x86_64 itself was not run locally (Apple Silicon host).
CONTRIBUTING.md (Fuzzing): notes the --target for prebuilt Linux binaries.
Remaining: AC #1 in the workflow itself and AC #2 need the manual run after the end-of-run push, which only Lux can trigger (`gh workflow run fuzz.yml`, optionally with a short `seconds` input first). Left In Progress for that.

2026-10-15 (Halo): pnpm check, cargo fmt and clippy clean on the branch. Commit df504d66. Handed to Lux for the post-push manual run; claim released.

2026-10-15 (Lux): verified by the manual run https://github.com/itsjavi/lumiose/actions/runs/38711418807 after the push: all 7 fuzz targets built with AddressSanitizer and ran without crashes. The run's property-tests job failed separately; that is TASK-344's follow-up.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The fuzz workflow builds every target for the runner's own target with AddressSanitizer; verified on GitHub (7 targets, no crashes).
<!-- SECTION:FINAL_SUMMARY:END -->
