---
id: decision-88
title: >-
  .sjsx (Styled JSX) files and JavaScript route files in @lumiose/stsx and
  Lumiose
date: '2026-10-25 04:10'
status: accepted
---
## Context

`.stsx` (Styled TSX, decision-11) is TypeScript only: plain `.jsx` files compile, but they cannot hold style blocks (LUM1006), and Lumiose's route files are `.stsx`, `.tsx` or `route.ts`. JavaScript React and Solid apps could not use `@lumiose/stsx` (decision-86) without moving to TypeScript.

On 2026-10-25 the user asked for a JavaScript counterpart (TASK-592, which lists the work by area). The user chose its name and scope:

- **Name.** "Styled JSX" is the counterpart of "Styled TSX". The user rejected "STSX for JavaScript" as misleading, and accepted that the name overlaps with Vercel's styled-jsx library.
- **Scope.** `@lumiose/stsx` and Lumiose, including JavaScript route files.

## Decision

**`.sjsx` files are Styled JSX:** JSX plus raw-CSS `<style>` blocks, parsed as JavaScript. Their styles work exactly as in `.stsx`:
- placement scoping, global blocks, `:global()` and `:deep()`, scoped keyframes;
- `$name` constants, which may come from `.js`, `.ts` or JSON modules;
- `scopedStyles`, class passthrough, and the same diagnostics.

The docs call the format Styled JSX next to Styled TSX, and STSX names both where the extension does not matter.

**Both toolchains support `.sjsx`:**
- `@lumiose/stsx`, for React, React Router and Solid. React Router route modules stay `.jsx`/`.tsx`, for the same reason as decision-86.
- Lumiose: the compiler, `@lumiose/vite`, the language server and VS Code, `lumiose fmt`, `lumiose lint`, the Prettier and ESLint plugins, and `lumiose check`.

**JavaScript route files in Lumiose.** Every route file name accepts the JavaScript counterpart of the TypeScript extensions it accepts today:

| TypeScript | JavaScript |
| ---------- | ---------- |
| `.stsx` | `.sjsx` |
| `.tsx` | `.jsx` |
| `.ts` | `.js` |

- **Pages and the other route components** (`page`, `layout`, `error`, `not-found`) take `.sjsx` and `.jsx`.
- **Endpoints** take `route.js`.
- **Middleware**, folder and root, take `.js` (folder middleware already does).
- **Instrumentation** takes `instrumentation.server.js` and `instrumentation.client.js`.
- **Conflicts.** Two files of one kind in a folder, with any mix of extensions, are an error, as two extensions of one kind are today.
- **Mixed projects.** TypeScript and JavaScript files can live in the same project.

**Type checking JavaScript** (delegated to the orchestrator, decision-16):
- A `.sjsx` file's shadow is `X.sjsx.jsx`, in the same shadow directory and `rootDirs` setup as `X.stsx.tsx`.
- Lumiose's generated tsconfig sets `allowJs`, so JavaScript modules resolve with types and editor features. The project decides `checkJs`; `lumiose check` type-checks JavaScript files only with it.
- Route types reach JavaScript through JSDoc: `@param {import("lumiose").PageProps<"/x">} props`.
- The compiler's reactivity checks (LUM2001, LUM2003, …) read the syntax, so they apply to JavaScript as they do to TypeScript.

**Out of scope for now:** a JavaScript template for `create-lumiose`, and JavaScript versions of the docs' examples, which stay TypeScript apart from one section per guide.

## Consequences

- **Who it is for.** JavaScript React, React Router and Solid apps can use scoped style blocks without TypeScript, and Lumiose apps can be written in JavaScript.
- **Cost.** Every place that names `.stsx` today learns `.sjsx`. The work is in M15, split by owner area (TASK-592's follow-ups).
- **Deferred (2026-10-25).** The user has no need for JavaScript support yet, so the M15 work is kept as drafts, DRAFT-6 to DRAFT-13, with their dependencies. The name and scope above stand; promote the drafts when the need comes.
- **Search.** Searches for "Styled JSX" also find Vercel's styled-jsx. The docs say early on that this is a different thing: style blocks scoped by placement, compiled by Lumiose's compiler.
- **Unchanged.** Existing `.stsx`, `.tsx` and `.ts` projects need no changes.
