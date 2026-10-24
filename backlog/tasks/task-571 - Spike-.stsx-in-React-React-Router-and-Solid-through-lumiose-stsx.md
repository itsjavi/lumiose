---
id: TASK-571
title: 'Spike: .stsx in React, React Router and Solid through @lumiose/stsx'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-24 23:36'
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
- [ ] #1 A React + Vite app renders a .stsx component with file-level, component-level and <style global> blocks and a $name constant imported from a .ts module, with the scoped CSS applied in dev and in a production build; Fast Refresh and CSS-only HMR are checked
- [ ] #2 A React Router framework-mode app with SSR uses .stsx components: their CSS is linked in the server-rendered HTML in dev and in production, with no unstyled flash; findings record whether route modules can themselves be .stsx
- [ ] #3 A SolidJS + Vite app meets #1 (dev, production build, HMR), with scoping on class
- [ ] #4 Findings record what works and what is missing for type checking (shadow files) and editor tooling (language server, VS Code extension) in a project that is not a Lumiose app
- [ ] #5 Findings list what the real implementation needs (compiler TSX emit target, napi entry, the @lumiose/stsx Vite plugin, check and shadow generation, docs) and recommend one of: build it, build it with documented limits, or drop it; API shape, options and passthrough remain proposals for the user
- [ ] #6 Screenshots of the three running apps are stored in backlog/assets and linked from the task
<!-- AC:END -->
