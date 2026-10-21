---
id: TASK-487
title: Extract gbaudio (formerly gbapu) into itsjavi/gbaudio and publish it to npm
status: In Progress
assignee:
  - '@Chime'
created_date: '2026-10-20 21:22'
updated_date: '2026-10-21 03:33'
labels: []
milestone: m-13
dependencies: []
priority: medium
ordinal: 483000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-73: a public MIT repository with the engine's TypeScript source, fresh history, tests, types and a build, published to npm as gbapu. The create-lumiose agent setup does not apply (no Lumiose code); it gets AGENTS.md, CLAUDE.md, README, LICENSE, oxlint, oxfmt, Vitest, CI and Renovate. Ask the user before creating the repository and before publishing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The user approved creating the repository and publishing
- [x] #2 github.com/itsjavi/gbaudio exists, MIT, with source, tests and CI
- [ ] #3 gbaudio is on npm and its types resolve
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-21, Chime: the package is prepared locally as its own git repository (`gbapu`, 5 Conventional Commits on `main`, no remote). Nothing is created on GitHub, pushed or published.

- **Package**: `gbapu` 0.1.0, MIT (Javi Aguilar), ESM, no dependencies, `sideEffects: false`, no `engines` (no Node APIs: typed arrays and `Blob` only). `exports` `.` points types and default to `dist/`; `files`: dist, README.md, LICENSE. TypeScript 7.0.2 build (strict, ES2022, declarations), pnpm 11.25.0, Vitest 5, oxlint, oxfmt. CI (`.github/workflows/ci.yml`, same action SHAs as Lumiose) runs install, typecheck, lint, fmt check, test, build and `npm pack --dry-run`; Renovate config copied from Lumiose without the Cargo rule.
- **Source**: the five engine modules are byte-identical to the author's source; `src/index.ts` re-exports them. Its declarations match `examples/spa-dotmatrix/vendor/gbapu/dist/*.d.ts`, plus additive optional driver-program types (`EffectDriverProgram`, `NoiseDriverProgram`, `WaveDriverProgram`, `MusicPulseDriverProgram`, `NoiseSampleBank`, `WaveSampleBank`) and channel fields. `audio-export` adds handling for writes at a finite wave channel's end cycle. Dotmatrix clamps writes to `total - 1`, so its renders do not change, and its imports switch with specifier changes only (TASK-488).
- **License**: `src/gbapu.ts` is a TypeScript port of stoneface86/gbapu (C++, MIT, copyright 2020 stoneface). LICENSE carries that notice after the project's MIT notice, and the README credits it.
- **Verification**: 27 Vitest tests (identical renders on repeat, the pitch of a pulse tone, NR51 routing, loops, render horizon and limits, a three-channel song's compiled writes and controls, token lookups, WAV header, encoding and `smpl` loop, `Apu` reset). Typecheck, lint, fmt check, build and the CI steps on a clean clone all pass. `npm publish --dry-run` accepts the tarball (15 files, 22.1 kB). The packed tarball installed in a scratch project: the README example runs and writes a valid WAV, and the types resolve under nodenext and bundler without skipLibCheck. The npm name `gbapu` is free.
- **Waiting for the user**: approval to create github.com/itsjavi/gbapu and push, and to publish to npm (AC #1 to #3). Open questions: the name `gbapu` (also the name of stoneface's C++ library), the README wording, and whether to reformat the verbatim engine modules (oxfmt skips them for now).

2026-10-21 (Lux): the user confirmed the stoneface86/gbapu port (credit and MIT notice kept), kept the unscoped npm name gbapu, and chose to format the engine sources (done in the package, local commits). Waiting for approval to create the repository, push and publish.

2026-10-21 (Lux): the user approved creating the repository and pushing; github.com/itsjavi/gbapu created (public) and main pushed (9 commits; the package description and README intro now name the stoneface86/gbapu port). The user publishes to npm themselves; AC 3 waits for that.

2026-10-21 (Lux): npm refused the name gbapu (too similar to gsap). The package is now gbaudio (user's choice); the user published 1.0.0 by hand, which npm holds as a staged release (only a 0.0.0-stage placeholder is visible) until the user approves it on npmjs.com. The repository was renamed to itsjavi/gbaudio and the local folder to ../gbaudio. The release workflow now skips a version npm already has, so tagging v1.0.0 creates the GitHub release without publishing again. Two local commits (rename, repository URLs plus skip) wait for the user's push approval.
<!-- SECTION:NOTES:END -->
