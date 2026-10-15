---
id: TASK-318
title: Ask the React Router and Next.js communities to review the benchmark apps
status: In Progress
assignee:
  - '@Lux'
created_date: '2026-10-15 04:03'
updated_date: '2026-10-15 06:30'
labels:
  - performance
  - benchmark
milestone: m-11
dependencies:
  - TASK-317
priority: low
ordinal: 320000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-55: draft a request for review of the React Router and Next.js implementations of the fullstack benchmark (what to review, where to file issues). Posting it is outward-facing: the user posts it or approves each post. Feedback becomes tasks, and fixed implementations get a new published run.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The review request is drafted and the user has posted or approved it
- [ ] #2 Feedback received is recorded as tasks
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Draft review request (Lux, 2026-10-15, unattended M10/M11 run). Posting is outward-facing, so it waits for the user: post it as a GitHub Discussion in the Lumiose repository, then link it from the React Router discussions on GitHub and the Next.js discussions on GitHub (or the communities the user prefers), and record each link here.

---

**Title:** Review request: are our React Router and Next.js benchmark apps idiomatic?

Lumiose publishes a fullstack comparison: the same app (a catalog with search, a cart, sign-in and form mutations) built with Lumiose, React Router 7 (framework mode), Next.js 16 (App Router) and five other stacks, measured on the same machine in interleaved rounds. The methodology, every implementation and every raw results file are public: https://github.com/itsjavi/lumiose/tree/main/benchmarks/fullstack and the page /benchmarks/fullstack-comparison on the Lumiose site.

The React Router and Next.js versions were written by the Lumiose maintainers, so they may not be what an experienced developer of those frameworks would write. We would like you to check:

- whether each app uses the idiomatic, production-recommended patterns for its framework (data loading, mutations, caching, streaming, bundling);
- whether the build and server settings match what you would deploy (production mode, compression, caching headers);
- anything that makes the comparison unfair in either direction.

Please open an issue with the label `benchmark`, or a pull request against `benchmarks/fullstack/apps/react-router` or `benchmarks/fullstack/apps/next`. Every accepted change gets a new published run, with the change noted next to the results.
<!-- SECTION:NOTES:END -->
