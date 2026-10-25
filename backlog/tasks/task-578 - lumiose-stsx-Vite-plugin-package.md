---
id: TASK-578
title: '@lumiose/stsx Vite plugin package'
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-25 00:31'
updated_date: '2026-10-25 01:14'
labels:
  - build
  - stsx
milestone: m-14
dependencies:
  - TASK-577
references:
  - >-
    backlog/decisions/decision-86 -
    .stsx-in-other-JSX-frameworks-through-lumiose-stsx.md
  - >-
    backlog/decisions/decision-85 -
    Scoped-styles-attribute-or-class-strategy-specificity-and-namespace-scopedStyles.md
  - >-
    backlog/tasks/task-571 -
    Spike-.stsx-in-React-React-Router-and-Solid-through-lumiose-stsx.md
  - packages/vite/src/styles.ts
priority: high
ordinal: 570000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Builds packages/stsx from the TASK-571 prototype. The prototype itself is not committed; its design is in TASK-571's notes.
- **Module ids.** Virtual `X.stsx.tsx` and `X.stsx.css` modules.
- **Dependency scan.** A scanner plugin (`optimizeDeps.rolldownOptions.plugins`, loading the masked TSX), so dependencies are not discovered late (no duplicate React).
- **Dev and transform.** A dev rewrite of `/x.stsx` URLs. The emit runs in `transform`, because React Router reads route files and transforms them itself.
- **Options.** `classAttribute` is required (the error names the value per framework). `scopedStyles` is validated (decision-85).
- **CSS and tokens.** CSS targets come from `build.cssTarget`. Tokens are stable across machines (root and package relative).
- **Diagnostics.** Through this.error/this.warn, with code frames.
- **React Router guard.** `.stsx` route modules are rejected with an error that shows the supported pattern.

Lockstep package: release scripts and README. Lux adds packages/stsx/** to Photon's area in AGENTS.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 packages/stsx releases @lumiose/stsx in lockstep, with stsx({ classAttribute, scopedStyles }) typed and validated at startup
- [x] #2 React + Vite and Solid + Vite fixtures render scoped styles in dev and production builds, with dependencies pre-bundled on the first load (no late discovery, no duplicate React)
- [x] #3 Under React Router, .stsx components work in dev and in SSR production builds, and a .stsx route module fails with an error that shows the supported pattern
- [x] #4 Diagnostics show in the Vite overlay and build output with the code, file:line:col and a code frame
- [x] #5 The package README documents setup for React, React Router and Solid
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux): standalone takeover of Photon's task at the user's request (M14 run).

2026-10-25 (Lux): packages/stsx is @lumiose/stsx, in lockstep (publishable, version 0.7.1, @lumiose/compiler workspace dependency pinned at release; scripts tests pass). stsx({ classAttribute, scopedStyles? }) is validated at startup (classAttribute required, with the value per framework in the error).
- Built from the TASK-571 prototype on compileTsx: virtual X.stsx.tsx (raw source in load, compileTsx in transform) and X.stsx.css; a dependency-scanner plugin with the masked TSX; a dev rewrite of /x.stsx URLs; $name constants resolved through this.resolve (or the environment plugin container in hotUpdate); CSS-only hot updates when the TSX is unchanged.
- Tokens are root-relative, and package-relative for files outside the root (nearest package.json). CSS targets: Vite's own CSS pipeline lowers the stylesheet for build.cssTarget, as with lumiose() (the compiler keeps modern syntax).
- Diagnostics: warnings through this.warn, then the first error through this.error, with code, message, help, file:line:column and a code frame.
- React Router: a .stsx route module (imported by virtual:react-router/server-build or server-manifest, or with a route-module query) is an error that shows the supported pattern.
- Tests (packages/stsx/src/plugin.test.ts, 9): options; React dev (TSX with Fast Refresh registration, CSS module, constants); React SSR with class markers and passthrough; React and Solid production builds; the scanner plugin; diagnostics (LUM3009 at Broken.stsx:8:15 with LUM3005 warned first); the React Router guard; Solid dev (markers in Solid templates).
- Verified by hand with the TASK-571 apps on this package: React Router production SSR links per-route CSS with data-lum- markers, dev renders and hydrates without errors, and a .stsx route in routes.ts fails the build with the guard message.
- README (setup per framework, styles, options, limits); AGENTS.md: packages/stsx/** in Photon's area. Preact is not claimed (untested).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
@lumiose/stsx is a lockstep Vite plugin package. stsx({ classAttribute, scopedStyles }) serves .stsx files to React, React Router and Solid through compileTsx, with dependency pre-bundling, CSS-only hot updates, framed diagnostics and a guard against .stsx React Router route modules. Tested on real dev servers and production builds.
<!-- SECTION:FINAL_SUMMARY:END -->
