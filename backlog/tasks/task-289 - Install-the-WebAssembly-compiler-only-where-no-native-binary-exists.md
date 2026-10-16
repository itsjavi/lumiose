---
id: TASK-289
title: Install the WebAssembly compiler only where no native binary exists
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-16 23:19'
labels:
  - packaging
  - compiler
dependencies: []
priority: low
ordinal: 291000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the itsjavi.com port to Lumiose 0.4.0 (the port's FINDINGS.md). A fresh pnpm install on darwin-arm64 installs @lumiose/compiler-wasm32-wasi (11.4 MB) next to @lumiose/compiler-darwin-arm64 (12.6 MB), because the wasm package has no os/cpu constraint. Check how napi-rs projects avoid it (for example, a wasm fallback that is not an optional dependency of the main package) without breaking platforms that need it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A fresh install on a platform with a native binary does not install the wasm package, and the wasm fallback still works where it is needed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon, 2026-10-17 (branch claude/photon-bugs-2c1927). Reproduced: the published @lumiose/compiler-wasm32-wasi manifest has no os/cpu, so pnpm and npm install it next to the native package (checked with a packed copy of HEAD's manifest on darwin-arm64).
Survey and choice in decision-67. napi-rs documents cpu: ["wasm32"] on the WASI package (package managers skip it unless wasm32 is enabled with supportedArchitectures or npm --cpu=wasm32); oxc, Tailwind's oxide and Astro's compiler binding ship it that way. napi-rs CLI 3.10's own release check wants no cpu (Solid ships without it), which is the behaviour this task removes; os/cpu negations cannot single out Windows on Arm.
Change: packages/compiler/npm/wasm32-wasi/package.json gets publishConfig.cpu [wasm32] (the native packages' mechanism, so the workspace keeps linking it); scripts/pack.ts rejects a WASI tarball without it (pack.test.ts). Loader unchanged.
Evidence (packed stub tarballs, offline installs on darwin-arm64): pnpm 11 and npm 11 default install the native package only; pnpm with supportedArchitectures.cpu [current, wasm32] installs both; npm --cpu=wasm32 or .npmrc cpu=wasm32 installs the WASI package. The playground runs crates/lumiose_wasm (wasm-bindgen), not this package, so it is unaffected.
Docs: getting-started.md (requirements: platforms and how to enable wasm32), packages/compiler/README.md, the WASI package README.
For the user (via Lux): platforms without a native binary (Windows on Arm, FreeBSD, riscv64, 32-bit ARM, WebContainers) now need one setting before installing; a native win32-arm64-msvc build would cover the largest of them at the cost of one more Binaries job.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
@lumiose/compiler-wasm32-wasi now publishes cpu: ["wasm32"] (publishConfig), as napi-rs documents and oxc, Tailwind's oxide and Astro's compiler binding do, so installs on platforms with a native binary skip its 11.4 MB. Platforms without one enable wasm32 (supportedArchitectures for pnpm and Yarn 4, cpu=wasm32 for npm); the loader's fallback is unchanged and was checked end to end with a packed install. pack.ts rejects a WASI tarball without the field. Choice and reasons in decision-67; getting-started and the compiler READMEs explain the setting. The playground (crates/lumiose_wasm) is unaffected.
<!-- SECTION:FINAL_SUMMARY:END -->
