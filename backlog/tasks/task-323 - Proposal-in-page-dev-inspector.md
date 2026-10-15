---
id: TASK-323
title: 'Proposal: in-page dev inspector'
status: In Progress
assignee:
  - '@Lux'
created_date: '2026-10-15 04:03'
updated_date: '2026-10-15 04:26'
labels:
  - proposal
  - needs-decision
  - dx
milestone: m-11
dependencies: []
priority: low
ordinal: 325000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). A dev-only inspector inside the page (no browser extension first): the owner tree, signals with their dependents, islands with their hydration state, and why something updated. It costs nothing in production builds. Names and UI need the user's approval (AGENTS.md).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A proposal with the features, shape, alternatives and prior art is reviewed by the user
- [ ] #2 Approved names are recorded and an implementation task is created
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal (Lux, 2026-10-15, drafted during the unattended M10/M11 run; waiting for the user's review).

**Shape (recommended): a dev-only inspector that `lumiose dev` injects next to its error overlay.**
- Opened with a keyboard shortcut (Alt+Shift+L) or a small button in a corner; rendered in a shadow root so app styles do not reach it, and it never ships in builds.
- **Tree:** the component owner tree of the page and its islands, with each component's props (a snapshot) and source location.
- **Signals:** the signals, computeds and effects a selected component owns, with their current values, their dependents, and the last write that changed them.
- **Islands:** each island with its strategy (`load`, `idle`, `visible`, `media`, `only`), its state (waiting, loading, hydrated, failed) and timings, which also surfaces TASK-305's load failures.
- **Why did this update:** for a selected DOM node or effect, the chain of signal writes that re-ran it.
- **Open in editor:** Alt+click an element to open its `.stsx` source at the line (Vite's open-in-editor endpoint), like Svelte's inspector.

**How it stays free in production:** the reactive core and the island loader call a dev hook registry (owner and signal creation, writes, effect runs, island transitions) only behind the existing `DEV` constant, so production bundles keep none of it and the 10 kB runtime cap (decision-55) is untouched. In dev, the compiler passes component names and source locations; signals get labels from their variable names.

**Alternatives:**
- A browser extension like React DevTools or solid-devtools: richer panels, but installs, store reviews and a protocol to version. The in-page inspector's hook registry can feed an extension later.
- Click-to-source only (Svelte's inspector): cheapest, but answers none of the "why did this update" questions.
- Logging helpers (`debug(signal)`): no UI, more noise.

**Names for the user to approve:** the shortcut (Alt+Shift+L), an `inspector` option in `lumiose()` (default on in dev, `false` to disable), and the panel names above.
<!-- SECTION:NOTES:END -->
