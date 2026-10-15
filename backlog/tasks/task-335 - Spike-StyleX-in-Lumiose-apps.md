---
id: TASK-335
title: 'Spike: StyleX in Lumiose apps'
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-15 04:11'
updated_date: '2026-10-15 07:41'
labels:
  - css
  - spike
milestone: m-11
dependencies: []
references:
  - packages/vite/src/styles.ts
  - packages/vite/src/css-manifest.ts
priority: medium
ordinal: 337000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15: find out whether StyleX can be used in Lumiose apps, and what it takes, before documenting it. Known friction: StyleX compiles `stylex.create()` at build time through a bundler plugin, which here has to run on the JS that the Lumiose compiler emits for `.stsx` files (plugin order is unverified); `stylex.props()` returns React's `className`, which Lumiose's JSX rejects (it uses `class`); its CSS must be linked by the CSS manifest in SSR builds, and dev must not flash unstyled content.

Spike only: a throwaway app in scratch space, nothing committed to the source tree. Use StyleX's current official Vite integration. Any new public API (a helper, accepting `className`, a plugin option) is a proposal for the user to approve, per the syntax and DX rule in AGENTS.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Findings record whether StyleX compiles in .stsx and .tsx files in dev, SSR and production builds, with its CSS linked in SSR output and HMR working
- [x] #2 Findings compare ways to apply StyleX styles to elements given `class` instead of `className` (a user-land helper, a StyleX API for other frameworks if one exists, or a Lumiose change), with trade-offs
- [x] #3 A recommendation is recorded in the task: supported as is, supported with a documented helper, or documented as unsupported; any public API change is left as a proposal for the user
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Lux, orchestrator): reassigned to Spark for the unattended M10/M11 run. New worker sessions cannot be started from automated turns, and Spark's session was idle with its own queue done; Spark may edit this task's area (crates, CI workflows, release scripts) for it, since no Photon or Halo worker is active.

Spark started 2026-10-15 (batch 4, reassigned).

Spike findings (Spark, 2026-10-15; throwaway app in .local/agents/Spark/, not committed). StyleX 0.19.1 with its official Vite integration @stylexjs/unplugin 0.19.1 (stylex.vite()), Lumiose from this branch, Vite 8.3.4.

Compiling
- .stsx: stylex.create() is never compiled. The unplugin's transformInclude is hardcoded to /\.[cm]?[jt]sx?(\?|$)/, so .stsx modules are skipped in dev and builds, and a create() call there throws at prerender ('Unexpected stylex.create call at runtime'). There is no include option. stylex.attrs()/props() calls in .stsx work: they are runtime functions on compiled objects.
- .ts and .tsx: stylex.create() compiles in dev, SSR and the production build, as styles modules or inside components and islands (an island with conditional styles updates on the client).
- Plugin order does not matter: [lumiose(), stylex.vite()] and [stylex.vite(), lumiose()] both build, also with on: attributes in .tsx (StyleX sees Lumiose's compiled output).

Dev (lumiose dev)
- SSR markup has StyleX's classes (plus its dev debug classes and data-style-src, identical on both sides: no hydration warnings). Its CSS is served at /virtual:stylex.css but not linked: the page is unstyled until the app links it. With {import.meta.env.DEV && <link rel="stylesheet" href="/virtual:stylex.css" />} in src/document.tsx the CSS is in <head> (no flash), checked in Chromium: computed colors, the island's state style, and the SPA route.
- HMR: an edit to a styles module applies; a module that server-rendered pages import reloads the page (Lumiose's rule for server modules). StyleX's runtime (import('virtual:stylex:runtime'), e.g. from src/instrumentation.client.ts in dev) only matters for client-only modules.

Production SSR build (lumiose build + lumiose preview): broken
- StyleX appends every rule to ONE existing CSS asset (index.css, style.css, else the first), re-emitting it under a new hash and deleting the old one in generateBundle. Lumiose links CSS per route.
- With [lumiose(), stylex.vite()]: Lumiose's server entry and prerendered HTML keep the pre-rename name (page-BHfy5tLk.css) while the file is page-BNLoLTSW.css: a 404, so that route loses StyleX's rules and its own scoped styles.
- With [stylex.vite(), lumiose()]: names are consistent, but all rules sit in the CSS of one route (here the home page, inlined there), so other routes (/spa) render without their StyleX rules.
- cssInjectionTarget pointed at a stylesheet the root layout imports (linked on every page) crashes the build in vite:css-post ('Cannot read properties of undefined (reading viteMetadata)'): StyleX deletes the renamed asset while Vite still resolves that pure-CSS entry by its old reference.

Applying styles given class (AC#2)
- stylex.attrs(...styles) (official, for non-React frameworks) returns { class, style (a string), data-style-src }: {...stylex.attrs(styles.title, active() && styles.on)} works in .stsx and .tsx with no helper and no Lumiose change. Recommended.
- class={stylex.props(...).className}: works for classes but drops props().style, a React-style object with camelCase keys that Lumiose's style (kebab-case) would misread: dynamic StyleX styles would be lost.
- A Lumiose change to accept className: rejected (class is the attribute name, decision on JSX; React compatibility props are not accepted).
- A user-land helper is unnecessary given attrs().

Recommendation (AC#3): document StyleX as not supported yet for server-rendered Lumiose apps (production builds link its CSS wrongly, and .stsx files cannot hold stylex.create()); attrs() is the way to apply it once supported. Do not add it to TASK-336's smoke test. To make it supported, proposals for the user (none started):
1. Lumiose (build, Nova/Photon area): resolve route CSS from the final bundle, after other plugins' generateBundle, so renamed assets are followed; and an opt-in way to link a plugin's consolidated stylesheet on every page (a public option: needs the user's approval).
2. Upstream StyleX (outward-facing, needs the user): an include option or .stsx in the unplugin's file filter; and appending CSS without deleting an asset Vite still references (the css-post crash).
Until then a workable path for client-only apps (lumiose/dom on plain Vite) was not exercised in this spike.

User decision, 2026-10-15 (parked decisions review): follow-up limited to the build-output fix (TASK-342); no public option and no upstream StyleX issues for now.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
StyleX spike: compiles in .ts/.tsx (dev and build), not in .stsx (unplugin's hardcoded file filter); dev works with a document link to /virtual:stylex.css; production SSR builds link its CSS wrongly (stale hash or one route only; targeting a root stylesheet crashes Vite). stylex.attrs() applies styles with class and string style, no helper needed. Recommendation: document as not supported yet; Lumiose and upstream StyleX proposals recorded for the user.
<!-- SECTION:FINAL_SUMMARY:END -->
