---
id: decision-89
title: >-
  The VS Code extension shares Lumiose's lockstep version and is published by
  the release workflow
date: '2026-10-25 17:01'
status: accepted
---
## Context

The VS Code extension (`packages/vscode`, TASK-30 and TASK-51) was never published: it was private at version 0.0.0, so the only way to install it was building it from a clone. Each `.vsix` bundles the language server and the native compiler of the commit it is built from, so its features and diagnostics are those of one Lumiose version. Options considered: lockstep with the other packages, or its own version outside lockstep like `@lumiose/ui` (decision-54). The Marketplace accepts only `x.y.z` versions, never publishes the same version twice, and treats a pre-release version as taken for the final release.

## Decision

User decision, 2026-10-25.

- **Lockstep version.** The extension has the version of the other Lumiose packages: `pnpm release:version` bumps it, and every `v<x.y.z>` release publishes it, also when only its bundled server or compiler changed. A fix to the extension alone ships as a Lumiose patch release.
- **Publisher `itsjavi`** (the user's Marketplace publisher): the extension ID is `itsjavi.lumiose-vscode`. Its package name stays `lumiose-vscode`, since `lumiose` names the framework package in the pnpm workspace.
- **Published by the release workflow**, after the Binaries workflow: the `.vsix` of every supported platform goes to the tag's GitHub release, the VS Code Marketplace and Open VSX (for Cursor, VSCodium and other forks), gated by `LUMIOSE_PUBLISH` like npm. Pre-release versions (`x.y.z-*`) only get the GitHub release files.

## Consequences

- The release script bumps `packages/vscode/package.json` although the package is private (not on npm).
- Marketplace publishing authenticates with Microsoft Entra ID, since Azure DevOps global PATs can no longer be created (2026-03-15) and stop working on 2026-12-01. If that fails for a personal publisher, the release's `.vsix` files can be uploaded by hand on the publisher's page.
- TASK-594 builds the job and documents the maintainer setup.

