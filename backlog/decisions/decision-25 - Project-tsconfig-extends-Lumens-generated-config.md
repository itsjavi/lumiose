---
id: decision-25
title: Project tsconfig extends Lumen's generated config
date: '2026-10-08 21:59'
status: accepted
---
## Context

Type-checking `.stsx` files relies on shadow files, `rootDirs`, includes and JSX settings (spec §4.7). TASK-73 added `.lumen/tsconfig.generated.json`, which Lumen keeps in sync, including linked workspace packages that contain `.stsx`. Copying all of these options into every project is error-prone. The user chose the extends approach on 2026-10-08.

## Decision

New projects' `tsconfig.json` is a minimal file that extends `./.lumen/tsconfig.generated.json`. Users add their own `compilerOptions` on top. `lumen dev`, `lumen build`, `lumen check`, `lumen typegen` and the Vite plugin all write the generated file.

## Consequences

- Projects stay correct when Lumen's requirements or the workspace layout change.
- A fresh clone must generate the file before running bare `tsc`. The Vite plugin and the CLI do this automatically.
