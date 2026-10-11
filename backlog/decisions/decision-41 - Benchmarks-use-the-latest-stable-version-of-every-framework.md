---
id: decision-41
title: Benchmarks use the latest stable version of every framework
date: '2026-10-11'
status: accepted
---
## Context

The landing page compares Lumiose with other stacks using our own benchmark results (decision-37), so outdated competitor versions would make the comparison unfair.

An audit on 2026-10-11 found:

- **Fullstack apps:** current, except Express in the React Router app (5.2.1, latest 5.3.0).
- **SSR benchmark:** current, except Solid (1.9.16, latest 1.9.17).
- **js-framework-benchmark entries:** installed from krausest's lockfiles, so they lag behind:
  - React 19.2.0 (latest 19.3.0)
  - Solid 1.9.3 (latest 1.9.17)
  - Svelte 5.42.1 (latest 5.57.2)
  - Vue Vapor on 3.6.0-rc.5 (latest 3.6.0-rc.11)

Solid 2 is a release candidate (`solid-js@next` 2.0.0-rc.14), and SolidStart's latest stable release (2.0.6) still requires `solid-js ^1.9.15`. The fullstack Solid app therefore stays on Solid 1.9.

## Decision

Requested by the user on 2026-10-11.

- Every benchmark uses the latest stable version of each framework that is compatible with the rest of its stack, pinned exactly and listed with its results.
- **Pre-releases join only as extra, labelled entries.** Solid 2 RC gets one in js-framework-benchmark and in the SSR benchmark, next to stable Solid.
- **Exception: a feature that ships only in a pre-release.** Vue Vapor is only in the Vue 3.6 RCs, so its entry uses the newest RC and is labelled as such.
- **Versions are checked before every measurement run.** The results name the versions they measured.
- **krausest's published factors measured older versions.** Where our versions differ, RESULTS.md says so.

## Consequences

- TASK-225 (Spark): js-framework-benchmark entries.
- TASK-226 (Nova): the SSR benchmark.
- The Express bump goes with Quasar's next fullstack task (TASK-204 notes).
- The quiet-machine measurement wave reruns every benchmark after these upgrades.
