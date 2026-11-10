---
id: TASK-599
title: >-
  Nightly fuzz: fix the scan timeout and the css_process panic; upgrade
  dependencies and pinned Actions
status: Done
assignee:
  - Lux
created_date: '2026-11-10T11:58:00Z'
updated_date: '2026-11-10T12:26:00Z'
labels: []
dependencies: []
priority: high
ordinal: 591000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The nightly Fuzz workflow has failed almost every night since 2026-11-04. Two findings: (1) the scan target times out: the LUM3013 ref-order check parses the masked text with OXC, which backtracks exponentially on inputs such as 'a <s <x,(y = a <[[[['; (2) the css_process target panics inside Lightning CSS (values/percentage.rs, unreachable) on a calc() mixing units. Also upgrade npm and Cargo dependencies to their latest versions and re-pin the GitHub Actions to their latest releases.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The scan fuzz input from the failing run scans in bounded time, with a regression test
- [x] #2 The css_process fuzz input no longer panics, with a regression test
- [x] #3 npm and Cargo dependencies are on their latest compatible versions, with skipped upgrades recorded
- [x] #4 GitHub Actions are pinned by SHA to their latest releases
- [x] #5 pnpm check passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Solo run by Lux (areas of Photon, Halo and others). scan: LUM3013 no longer parses with OXC; the lexer collects top-level const/let/using/class bindings (decorated classes and export default class are missed; TypeScript still reports those). css_process: process catches Lightning CSS panics as LUM3014; the css_process and compile fuzz targets install a quiet panic hook. Rust: oxc 0.158 (JSStr migration), comrak 0.59, napi 3.16.1, napi-derive 3.7.0, wasm-bindgen 0.2.130 (local playground builds need wasm-bindgen-cli 0.2.130). npm: all latest except typescript 6 in the Astro/SvelteKit/Nuxt benchmark apps, @babel/core 7 in benchmarks/ssr, OpenTelemetry sdk-node/exporter/resources/api, prisma 7, @types/node 24, @types/vscode; pnpm 11.28.11 (12 not taken). Actions: rust-cache v2.9.3, pnpm/action-setup v6.1.1, install-action v2.90.0; the rest were current. Validation: pnpm check steps and cargo clippy pass locally. Not verified: the fuzz targets under libFuzzer (no nightly toolchain locally) and CI, which need a push. Follow-up: TASK-600 (OXC exponential parse still reachable through compile).
<!-- SECTION:NOTES:END -->
