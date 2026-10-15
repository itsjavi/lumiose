---
id: TASK-316
title: Submit Lumiose to the upstream js-framework-benchmark
status: In Progress
assignee:
  - '@Spark'
created_date: '2026-10-15 04:02'
updated_date: '2026-10-15 05:34'
labels:
  - performance
  - benchmark
milestone: m-11
dependencies: []
priority: medium
ordinal: 318000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-55: prepare a keyed Lumiose implementation for the upstream js-framework-benchmark (krausest/js-framework-benchmark) following its rules, so results become official. Opening the upstream pull request is outward-facing: the user approves it first. Until official results exist, the site's claims stay as they are.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The implementation follows the upstream rules and passes its checks locally
- [ ] #2 The user approved, and the upstream pull request is opened
- [ ] #3 Once accepted, the official results are linked from the site
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark started 2026-10-15 (batch 2): preparing the implementation (AC#1); the upstream PR stays parked for the user.

AC#1 done (Spark, 2026-10-15):
- benchmarks/js-framework-benchmark/upstream/frameworks/keyed/lumiose: krausest's layout (package.json with js-framework-benchmark metadata, frameworkVersionFromPackage lumiose, repoURL, language TypeScript, license MIT; fixed versions lumiose 0.4.0, @lumiose/vite 0.4.0, vite 8.3.4; npm package-lock.json; index.html; vite.config.js building dist/main.js). The app sources are this package's src/App.stsx and src/main.tsx, copied in when the entry is assembled (one source for what we measure and what we submit).
- scripts/jsfb-upstream.ts (pnpm bench:jsfb:upstream): sparse-checks out krausest bf894b6 into .krausest-upstream/ (gitignored), installs its CLI (npm ci --legacy-peer-deps: upstream's root lint deps conflict and its CLI imports semver from devDependencies), server and runner, assembles the entry, starts the server on 8080 and runs krausest's own npm run rebuild-ci keyed/lumiose. Result: npm ci and build-prod OK with the npm packages, smoke run of every benchmark OK, isKeyed: keyed for run, remove and swap, checkCSP OK, 'All checks are fine!'. Options: --lock refreshes the lockfile, --export DIR copies the entry into a krausest fork.
- Rules: vanillajs HTML with aria-hidden and the preloaded glyphicon; selection as one id (#800); no explicit delegation (#801), manual DOM (#772) or rAF (#796) in app code.
- Parked for the user: AC#2 (approve and open the upstream PR: release the version to submit, bump the two packages, run with --lock --export, open the PR with only that folder) and AC#3 (link official results once krausest publishes them). upstream/README.md has the steps.
<!-- SECTION:NOTES:END -->
