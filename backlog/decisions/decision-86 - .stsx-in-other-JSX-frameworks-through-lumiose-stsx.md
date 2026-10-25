---
id: decision-86
title: .stsx in other JSX frameworks through @lumiose/stsx
date: '2026-10-25 00:28'
status: accepted
---
## Context

The TASK-571 spike showed that `.stsx` files compile for React, React Router (framework mode with SSR) and Solid through a Vite plugin built on `@lumiose/compiler`, without Lumiose's runtime. It covered scoped CSS, `$name` constants, global blocks, CSS extraction per route, SSR without unstyled flashes, HMR and `tsc` type checking through shadow files.

It also found the limits:
- React Router 8.4 cannot use `.stsx` route modules. Its route-module transforms match module ids against routes.ts paths, so server-only exports stay in the client module in dev, and `loaderData` is not injected.
- Class passthrough relies on Lumiose's runtime.
- The unused-selector check reads `class`, not `className`.
- The language server shows Lumiose-only diagnostics and hovers.

The user approved the package name `@lumiose/stsx` and, on 2026-10-25, the options and tooling below (AskUserQuestion).

## Decision

**Package.** `@lumiose/stsx` (packages/stsx) is a Vite plugin that compiles `.stsx` files for any JSX framework. The framework's own Vite plugin compiles the JSX.
- **Name.** Before the first release, the user considered Vite's `vite-plugin-` prefix convention (`@lumiose/vite-plugin-stsx`) and kept `@lumiose/stsx` (2026-10-25). The package is the home of the format outside Lumiose: besides the plugin, it ships the `stsx typegen` bin and the STSX docs. The `vite-plugin` keyword in its package.json keeps it findable as a Vite plugin.
- **Modules.** `X.stsx` is served as the virtual module `X.stsx.tsx`, with its stylesheet as `X.stsx.css`. That way every framework plugin's `.[jt]sx?` filters accept it.
- **Emitted TSX.** The source with its `<style>` blocks removed, the scope markers stamped per `scopedStyles` (decision-85), and an import of the stylesheet.
- **Compiler mode.** The compiler gets a TSX emit mode for this. It skips Lumiose analysis and codegen, parses once, maps the emitted TSX back to the `.stsx` source, and reports only scanner and style (LUM3xxx) diagnostics.

**Options (approved by the user)**
- `stsx({ classAttribute, scopedStyles? })`.
- `classAttribute: "className" | "class"` is required. Its error message names the value each framework uses: `className` for React and Preact, `class` for Solid. It feeds the unused-selector inventory and class passthrough.
- `scopedStyles` is the shared option of decision-85.
- **Class passthrough** works only with `strategy: "class"`. When a parent passes `classAttribute` to a component, the parent's scope classes are appended to it, so any component that forwards it receives them. With the attribute strategy there is no passthrough; `:deep()` reaches child components.

**React Router.** `.stsx` route modules are rejected with an error that shows the supported pattern: a `.tsx` route module that renders `.stsx` components. Components in `.stsx` work in route modules as usual.

**Type checking (approved by the user).**
- The package ships an `stsx typegen` bin. It writes the masked TSX of every `.stsx` file as shadow `*.stsx.tsx` files. The plugin writes them too, during dev and build.
- The shadow directory is the one the tsconfig `rootDirs` pair names: `rootDirs: [".", ".lumiose/stsx"]`. Without such a pair, the default is `.lumiose/stsx`, and `stsx typegen` prints the `rootDirs` line to add.
- One configuration serves `tsc`, the bin, the plugin and the language server.

**Language server.**
- **Mode selection.** A project that depends on `@lumiose/stsx` but not on `lumiose` gets an stsx mode of the same server, picked automatically per project.
- **Kept.** TypeScript features through the shadows, CSS features in style blocks, and the class-name features between JSX and styles, which count both `class` and `className`.
- **Removed.** Lumiose's runtime diagnostics (LUM2xxx, LUM4xxx), the execution-contract hovers and the route types.

**Versioning.** Delegated to the orchestrator (decision-16): `@lumiose/stsx` follows the lockstep versions. It is bound to the compiler's version and output, unlike `@lumiose/ui` (decision-54).

## Consequences

- **Adoption.** React, React Router, Solid and Preact users can adopt `.stsx` without adopting Lumiose. Lumiose's styles story and tooling become useful on their own.
- **Areas that change.** New compiler surface (the TSX emit mode and its napi entry), a new package in the release scripts, and an AGENTS.md ownership row for packages/stsx.
- **Test matrix.** Each supported framework needs at least a build and SSR smoke test.
- **Known limit.** Route modules in `.stsx` stay unsupported until React Router accepts other route module extensions. A proposal to React Router is drafted for the user to review before anything is posted.
- **The spike's HMR and source-map findings** are requirements of the plugin: one hot update per save, CSS-only updates when the TSX is unchanged, and source maps that resolve to the `.stsx` source.
- **Work.** TASK-577 (compiler emit mode), TASK-578 (plugin package), TASK-579 (HMR), TASK-580 (source maps), TASK-581 (`stsx typegen`), TASK-582 (language server mode), TASK-583 (guide and examples) and TASK-584 (React Router proposal draft), in milestone M14.
