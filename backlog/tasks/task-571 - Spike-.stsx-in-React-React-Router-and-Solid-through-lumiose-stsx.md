---
id: TASK-571
title: 'Spike: .stsx in React, React Router and Solid through @lumiose/stsx'
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-24 23:36'
updated_date: '2026-10-24 23:55'
labels:
  - spike
  - compiler
  - css
dependencies: []
references:
  - >-
    backlog/decisions/decision-11 -
    Author-components-in-.stsx-files-TSX-plus-raw-CSS-style-blocks-and-plain-.tsx.md
  - >-
    backlog/decisions/decision-12 -
    Raw-CSS-style-blocks-with-build-time-constant-interpolation-and-no-reactive-CSS.md
  - >-
    backlog/decisions/decision-14 -
    Style-scope-follows-placement-component-file-global.md
  - crates/lumiose_compiler/src/scanner/mask.rs
  - crates/lumiose_compiler/src/css.rs
  - crates/lumiose_css/src/lib.rs
  - packages/vite/src/styles.ts
priority: medium
ordinal: 563000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-25: prove that `.stsx` files (TSX plus raw-CSS `<style>` blocks, decisions 11, 12 and 14) can be compiled for other JSX frameworks, decoupled from the Lumiose runtime, through a Vite plugin. Targets: plain React with Vite, React Router framework mode, and SolidJS with Vite.

The package name `@lumiose/stsx` was approved by the user on 2026-10-25. Its options and public API remain proposals, per the syntax and DX rule in AGENTS.md.

Starting point: the scanner and masking, `$name` constant resolution and the `lumiose_css` crate are framework-agnostic. Two things are not: the Lumiose codegen, which stamps `data-l-<token>` scope attributes into DOM templates, and class passthrough (the hidden `$$scope` prop plus the runtime). The spike replaces the codegen with a TSX emit that does the following:
- Removes the style blocks and `$ref` artifacts.
- Stamps `data-l-<token>=""` on intrinsic elements, following the scope plan in `css.rs`.
- Imports the file's CSS as a virtual `?…&lang.css` module.
- Emits a source map.
- Hands the TSX to the framework's own JSX transform (`@vitejs/plugin-react`, `vite-plugin-solid`).

Spike only: throwaway apps in scratch space, nothing committed to the source tree. The prototype can be a JS layer over the existing `@lumiose/compiler` napi API (`scan`, the CSS output of `compile`) to avoid Rust changes. Findings must say what a real compiler implementation needs.

Open questions to answer:
- **Plugin order and module ids.** Whether `enforce: "pre"` works, and whether plugin-react and vite-plugin-solid accept `.stsx` through `include` or need a `.tsx`-suffixed id.
- **HMR.** React Fast Refresh and Solid HMR on `.stsx` modules, plus CSS-only HMR.
- **SSR CSS.** Whether React Router links the CSS of `.stsx` modules in dev and production builds, with no unstyled flash and no 404 after asset renames.
- **React Router route modules.** Whether route modules can be `.stsx` (route export analysis by `@react-router/dev`) or only components imported from `.stsx`.
- **Type checking and editor.** Shadow `*.stsx.tsx` files outside a Lumiose project, and whether the language server and VS Code extension work there.
- **Class attribute.** `className` (React) vs `class` (Solid) for scoping.

Class passthrough is out of scope for the proof: drop it, or document `:deep()` instead. One alternative is a class-based token: append the scope token to the `className`/`class` passed to components, which needs a class-based scoping mode in `lumiose_css`. That alternative is a proposal for the user.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A React + Vite app renders a .stsx component with file-level, component-level and <style global> blocks and a $name constant imported from a .ts module, with the scoped CSS applied in dev and in a production build; Fast Refresh and CSS-only HMR are checked
- [x] #2 A React Router framework-mode app with SSR uses .stsx components: their CSS is linked in the server-rendered HTML in dev and in production, with no unstyled flash; findings record whether route modules can themselves be .stsx
- [x] #3 A SolidJS + Vite app meets #1 (dev, production build, HMR), with scoping on class
- [x] #4 Findings record what works and what is missing for type checking (shadow files) and editor tooling (language server, VS Code extension) in a project that is not a Lumiose app
- [x] #5 Findings list what the real implementation needs (compiler TSX emit target, napi entry, the @lumiose/stsx Vite plugin, check and shadow generation, docs) and recommend one of: build it, build it with documented limits, or drop it; API shape, options and passthrough remain proposals for the user
- [x] #6 Screenshots of the three running apps are stored in backlog/assets and linked from the task
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux): standalone takeover of Photon's task at the user's request; the spike stays in scratch space.

Spike findings (Lux, 2026-10-25). The prototype is throwaway and lives in .local/agents/Lux/, not committed. It consists of a ~250-line JS Vite plugin over the existing @lumiose/compiler napi API (no Rust changes), plus three apps: React + Vite, React Router framework mode with SSR, and Solid + Vite. Versions: Vite 8.3.4, React 19.3.0, @vitejs/plugin-react 6.1.2, React Router 8.4.0, solid-js 1.9.17, vite-plugin-solid 2.11.14, TypeScript 7.0.2.

How the prototype works
- **Virtual JS module.** `X.stsx` resolves to the virtual module `X.stsx.tsx`. The filters of Vite's oxc transform, plugin-react, React Router's refresh transform (`/\.(jsx?|tsx?|mdx?)$/`) and vite-plugin-solid only accept `.[jt]sx?`, so a bare `.stsx` id would get no JSX transform and no Fast Refresh.
- **Emit.** `compile()` provides the scoped CSS and `meta.scopeTokens`, and `scan()` provides the block spans and the masked TSX. oxc-parser finds the intrinsic JSX elements in the masked TSX. magic-string then makes three edits:
  - removes the blocks;
  - stamps `data-l-<token>=""`: the file token on every intrinsic element, and each subtree token on the elements inside its scope element;
  - prepends `import "X.stsx.css"`.
  The framework compiles everything else.
- **Virtual CSS module.** The CSS is served as the virtual module `X.stsx.css`, so Vite's CSS pipeline, extraction and per-route splitting apply unchanged.
- **Non-obvious requirements:**
  - A dependency-scanner plugin (`optimizeDeps.rolldownOptions.plugins`, loading the masked TSX). Without it, React is discovered late and duplicated ("Invalid hook call").
  - A dev middleware that serves `/x.stsx` URLs as `x.stsx.tsx`.
  - The emit has to run in `transform`, not `load`, because React Router reads route files itself and transforms them.
- **HMR.** `hotUpdate` recompiles the file and always updates its CSS module. It updates the JS module only when the emitted TSX changed. When a module that `$name` constants come from is edited, the CSS of the files using it is updated too.

AC#1 React + Vite. Checked in dev and in the production preview:
- File-level, component-level and `<style global>` blocks all apply.
- Counter's scoped `button` rule does not reach App's button.
- `$name` constants from tokens.ts fold, including inside `@media`.
- **HMR:**
  - A style-only edit re-fetches only `Counter.stsx.css` and keeps hook state.
  - A JSX edit triggers Fast Refresh and keeps state.
  - A tokens.ts edit hot-updates the CSS of both files without a remount.

AC#2 React Router (SSR). `.stsx` components inside `.tsx` routes work:
- **Production.** Each route gets its own CSS asset (root, home, about), and each document links its own (`/` gets root + home, `/about` gets root + about). Hydration works: the counter starts from loader data.
- **Dev.** React Router's critical CSS (`/@react-router/critical.css`) includes the `.stsx` styles, so there is no unstyled flash.
- **Client navigation** loads the route's CSS.
- **HMR.** CSS-only updates and Fast Refresh both keep state.
- **`:deep()`.** `:deep(a)` styles the `<a>` that NavLink renders.

`.stsx` route modules are not viable with React Router 8.4:
- **What breaks.** React Router matches module ids against the routes.ts paths (`getRoute`). A route `routes/x.stsx` served as `x.stsx.tsx` therefore skips `react-router:route-exports`, with two consequences:
  - No `withComponentProps`: the component gets no `loaderData`, and SSR crashes.
  - Worse, server-only exports (`loader`, `action`) are not removed from the client module in dev. Verified: the module served to the browser contained `loader`.
- **Why it can't be worked around.** Keeping the real `.stsx` id fails React Router's `.[jt]sx?` filters instead.
- **Supported pattern.** A `.tsx` route module that renders a `.stsx` view component (app/routes/about.tsx in the spike).
- **What's needed.** Going further needs a React Router change (configurable route module extensions). Until then, the plugin should reject `.stsx` route modules.

Issue: under React Router, each save sends up to 4 duplicate client updates (1 under plain Vite). They need deduplicating.

AC#3 Solid + Vite. Dev and the production preview work with `class`.
- **Templates.** The scope attributes land in Solid's static templates, so they cost nothing at runtime.
- **`<For>`.** Elements created by `<For>` carry the scope token.
- **HMR.**
  - A style-only edit updates only the CSS.
  - A JSX edit hot-updates without a reload, but local signals reset. A plain `.tsx` control component resets the same way, so this is solid-refresh's behaviour, not a `.stsx` issue.

AC#4 Types and editor
- **Type checking works outside Lumiose.**
  - A 20-line generator writes the masked TSX as `.stsx-shadow/**/*.stsx.tsx`. With `rootDirs: [".", ".stsx-shadow"]`, stock `tsc` (TS 7.0.2) resolves `import "./X.stsx"`.
  - All three apps check clean (React Router after its own typegen).
  - Injected errors are reported at the exact `.stsx` line and column, including `$brand.nope` inside CSS (TS2339).
- **Language server.** Read, not run in an editor.
  - It finds the project root from tsconfig.json or package.json, and the shadows from a `rootDirs` pair under `.lumiose/shadow`. A React project could therefore use it with `rootDirs: [".", ".lumiose/shadow"]`.
  - However, it reports Lumiose compiler diagnostics (reactivity LUM2xxx, islands LUM4xxx) and execution-contract hovers, which are wrong for React and Solid, and LUM3005 misreads `className`. It needs a framework mode.
  - The VS Code grammar is framework-agnostic.
  - Not verified in a real editor.

Other gaps
- **LUM3005 and `className`.** The compiler's element inventory reads `class`, so with React's `className` every scoped selector looks unused. The prototype hides LUM3005 for React; Solid (`class`) is fine.
- **Source maps.** Production maps list `App.stsx` but also the virtual `*.stsx.tsx` ids, so the map chain needs fixing.
- **Triple parsing.** The prototype parses each file three times: `compile()` (including the Lumiose codegen it discards), `scan()` and oxc-parser.
- **Class passthrough.** Not supported. The documented `:deep()` works instead.

AC#5 What a real implementation needs
1. **Compiler.** A TSX emit mode in `compile()`, or a new napi entry, that:
   - skips Lumiose analysis and codegen;
   - stamps scope tokens through source edits, with a source map;
   - returns TSX, CSS, maps and style diagnostics;
   - takes the class attribute name (`class` or `className`) for the LUM3005 inventory.
2. **The `@lumiose/stsx` Vite plugin**, which carries over from the prototype and adds:
   - the virtual ids, the dep-scanner plugin and the dev URL rewrite;
   - HMR with CSS-only updates, constant dependencies and deduplicated updates;
   - diagnostics with code frames;
   - tokens that follow `build.cssTarget`, root and package;
   - rejection of `.stsx` route modules under React Router.
3. **Type checking.** A standalone shadow generator and check (or `lumiose typegen` with a framework option), plus tsconfig docs.
4. **Language server.** A framework mode (style diagnostics only, no contract hovers, `className`-aware), verified in VS Code.
5. **Docs.** A guide for React, React Router and Solid in packages/lumiose/docs, the package README, and examples with an e2e smoke test per framework.

Recommendation: build it, with documented limits (components only under React Router, no class passthrough). Open proposals for the user:
- the plugin's options and API shape;
- whether the package follows the lockstep versions;
- class passthrough: drop it, or append a class-based token to the `className`/`class` passed to components.

Screenshots: backlog/assets/task-571-react-vite-dev.png, backlog/assets/task-571-react-router-dev.png, backlog/assets/task-571-solid-vite-dev.png
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Proved that .stsx compiles for React, React Router and Solid through a Vite plugin layered on the existing @lumiose/compiler API: scoped CSS, $name constants, global blocks, CSS extraction per route, SSR without unstyled flashes, HMR (CSS-only updates, Fast Refresh, constant edits), and type checking through shadow files with stock tsc. Limits: React Router route modules cannot be .stsx (server-only exports stay in the client module, and loaderData is not injected), so use .tsx routes with .stsx view components. Class passthrough is out; LUM3005 needs className support; source maps and duplicate HMR updates need fixing; the language server needs a framework mode. Recommendation: build @lumiose/stsx with documented limits; its API shape, versioning and passthrough are proposals for the user.
<!-- SECTION:FINAL_SUMMARY:END -->
