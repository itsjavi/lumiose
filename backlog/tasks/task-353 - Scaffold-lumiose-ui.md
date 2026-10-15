---
id: TASK-353
title: Scaffold @lumiose/ui
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-15 16:46'
updated_date: '2026-10-15 17:12'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-333
priority: high
ordinal: 354000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike, proposal and measurements in TASK-332's notes). Create packages/ui (@lumiose/ui): exports per component, its own 0.x versions outside lockstep (TASK-333), CSS in the lu.tokens, lu.core and lu.theme cascade layers, a size budget reported by pnpm size (decision-55: measured separately from the runtime cap), and a UI section in the docs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The package builds, type-checks and packs with its own version
- [ ] #2 pnpm size reports its JS and CSS per component
- [ ] #3 The docs have a UI section, even if it only lists what is coming
- [ ] #4 Unstyled: ships only the CSS the primitive needs to work, in one low-priority layer
- [ ] #5 Passes every item of the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) that applies
- [ ] #6 The package exports @lumiose/ui/themes/default.css, driven by --lu- custom properties, with light and dark
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. The package ships unstyled: only the CSS a primitive needs to work (display, positioning and anchoring, the top layer, CSS variables), in one low-priority layer; no theme, no design tokens. Example styling lives in docs and test pages only. Check the work against the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) before Done.

2026-10-15 (user): besides the unstyled components, the package exports an optional theme, @lumiose/ui/themes/default.css (decision-62): the spike port's styles with a blue primary, driven by --lu- prefixed shadcn variables, light and dark, in a layer above the required CSS. The pitfall checklist is doc-9.

2026-10-15 (Halo): claimed (branch claude/halo-m12-945f07). Scaffolded packages/ui after the user's amendment to decision-62 (unstyled, one low-priority layer).

- Layout: one directory per component (src/dialog/dialog.tsx, dialog.css, tests); src/index.ts re-exports every component; package exports '.', one entry per component ('./dialog') and per stylesheet ('./styles.css' for all, './dialog.css'). Workspace exports point at src/, publishConfig.exports at dist/.
- CSS: unstyled; everything in one cascade layer named 'lu', declared first in each stylesheet. No tokens, no theme, no default classes or part attributes; parts are styled through class props and native/ARIA state.
- Shipping format (technical decision, recorded for Lux): the package ships its .tsx and .css sources (build = copy src to dist without tests), for the app's Lumiose compiler to compile with the app's options (server or client target, strict CSP, cssTargets, dev tools). Precompiling would bake one set of options in and tie @lumiose/ui's own 0.x line to one lumiose version's compiled runtime helpers. Gap: @lumiose/vite only compiles .tsx outside node_modules (default exclude) and only links workspace packages, so an npm-installed @lumiose/ui does not compile yet; proposed follow-up for Photon (compile Lumiose component packages from node_modules: peer dependency on lumiose, ssr.noExternal, optimizeDeps.exclude). Inside the workspace it works as site-kit does.
- Version: 0.0.0 and private: true until TASK-333 (Photon) lands. pack:check and release:version require one shared version across publishable packages, so a public 0.0.0 would fail both; TASK-333 removes 'private' once the release script supports the exception. pnpm pack works (dist/ only, lumiose peer ^0.4.0).
- Size: 'pnpm --filter @lumiose/ui size' prints per component the elements JS (server pages), the component JS compiled for islands and the CSS (min/gzip/brotli), with the lumiose runtime excluded. Report-only: decision-55 measures opt-in packages apart from the runtime caps and sets no cap for them; not wired into pnpm check (root config, Lux's call).
- Docs: packages/lumiose/docs/ui/README.md and a UI section in the docs index; 'ui/' added to the CLI's section order and to the docs contract test (packages/cli/src/docs, Beacon's area, two lines).
- Public names beyond decision-62, for the user's review: the 'lu' layer name; the export paths '@lumiose/ui/dialog', '@lumiose/ui/styles.css', '@lumiose/ui/dialog.css'.
<!-- SECTION:NOTES:END -->
