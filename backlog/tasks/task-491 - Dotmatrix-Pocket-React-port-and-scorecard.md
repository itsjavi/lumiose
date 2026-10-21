---
id: TASK-491
title: 'Dotmatrix Pocket: React port and scorecard'
status: In Progress
assignee:
  - '@Quasar'
created_date: '2026-10-20 21:23'
updated_date: '2026-10-21 06:00'
labels: []
milestone: m-13
dependencies:
  - TASK-488
priority: medium
ordinal: 487000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-70: an idiomatic React port of Dotmatrix Pocket as apps/pocket-react in the itsjavi/dotmatrix workspace: React 19, React Compiler, Vite and the same CSS as CSS modules, written as React is written today rather than translated line by line; served at /dotmatrix/react/. Record its scorecard in the repository's README and in doc-11: JavaScript shipped, source lines, interaction and audio timing, build time and DX notes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 apps/pocket-react matches the Lumiose app's features and look
- [ ] #2 It is deployed at /dotmatrix/react/
- [x] #3 The scorecard is in the repository README and in doc-11
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-21, Quasar (worker for Lux): the React port is done on branch `react-port` of itsjavi/dotmatrix (local, not pushed; main merged in, 7 commits ahead).

- **Port.** `apps/pocket-react` (`@dotmatrix/pocket-react`): React 19.3 with the React Compiler 1.0 (Babel), React Router 8.5 data mode with lazy route modules (the studio's `loader` opens share links), Zustand 5 + Immer 11 (immutable song, undo keeps the previous song), the pocket's CSS as CSS modules, MDX for the composing guide. The driver, model, render worker and demo songs are copied unchanged (identical files). Builds below `LUMIOSE_BASE`, so `pnpm build:site` puts it at `/dotmatrix/react/`.
- **Look.** Pixel diffs of the production builds at 1440, 820 and 390 px, dark theme with the Dusk palette, and seven interactive states match except the "Built with" credits.
- **Scorecard** (README "Lumiose vs React", for doc-11). Lumiose vs React:
  - JS (brotli), studio/songs/learn: 50.8/36.8/32.6 kB vs 125.7/107.9/103.2 kB. React + React DOM 56.8 kB, React Router 26.9 kB; Lumiose runtime 17.7 kB.
  - CSS: 10.1/7.1/7.1 vs 10.5/8.1/7.6 kB. Requests: 13/11/11 vs 10/9/8.
  - First load, slow 4G and 4x CPU, studio: shows 0.70 s and works 1.50 s, vs 3.01 s.
  - Build, cold/warm (median of 5): 1.22/1.19 s vs 1.59/1.60 s. The Babel compiler is about 1.0 s of it.
  - Interactions and audio timing: no meaningful difference.
  - Source lines (code + styles): 5,669 vs 5,867. Runtime deps: 5 vs 9 direct (12 installed).
- **Validation.** `pnpm check` green, all three apps build, all e2e suites pass (advanced 28, pocket 66, pocket-react 62 = 31 flows x dev/preview, site 8).
- **For Lux.**
  - Lumiose gap candidate: the songs gallery's prerendered HTML (18 kB) hydrates to working at 2.8 s on the slow profile, a little later than the React SPA (2.7 s).
  - Inherited app bug, in both apps: `/learn/composing` overflows sideways at phone width (article 699 px at 390 px).
  - Pocket and its React port share their `localStorage` keys on purpose (same songs on one origin); AGENTS.md says so. Reverse it if that is unwanted.

2026-10-21 (Lux): merged into dotmatrix main (fast-forward, 619b60a); pnpm check green for the three apps. The scorecard is in doc-11 and the dotmatrix README. Findings: TASK-515 (hydration cost of large prerendered pages), TASK-516 (composing guide overflow, both apps). Open for the user: whether pocket and pocket-react keep sharing localStorage keys. Deployment at /dotmatrix/react/ waits for the push.
<!-- SECTION:NOTES:END -->
