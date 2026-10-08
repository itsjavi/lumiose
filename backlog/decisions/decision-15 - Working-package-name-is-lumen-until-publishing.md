---
id: decision-15
title: Working package name is lumen until publishing
date: '2026-10-08 11:34'
status: accepted
---
## Context

TASK-2 research found that the npm name `lumen`, the `create-lumen` package and the `lumen-compiler` crate are already taken. Spec v0.1 therefore used `lumen-jsx` as the working package name. The user decided (2026-10-08) to use the name `lumen` for now and rename when the project is published.

## Decision

- **Packages:** `lumen` is the package name everywhere until publishing. That covers imports (`import { signal } from "lumen"`), subpaths (`lumen/server`, `lumen/vite`, `lumen/jsx-runtime`), `jsxImportSource: "lumen"`, scoped packages (`@lumen/*`), crates (`lumen_*`), and the CLI binary `lumen`.
- **Brand:** the product brand stays "Lumen".
- **Publishing:** the final npm and crates names are decided before the first publish. That rename is planned as an explicit roadmap task.

## Consequences

- Code, docs and examples stay short and readable during development.
- The rename must be a mechanical, one-pass refactor. To keep it that way, avoid spreading the package name into generated identifiers, diagnostic codes or file names (the `LUM` diagnostic prefix and the `.stsx` extension are not tied to the package name).
- Nothing can be published to npm or crates.io under these names.

