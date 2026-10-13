---
id: decision-47
title: No migration paths or upgrade docs before real usage
date: '2026-10-13 23:45'
status: accepted
---
## Context

Lumiose is pre-1.0 and no real usage of the framework has been detected. Changes so far still came with migration work: an "Upgrading from 0.1" docs page, deprecation aliases and compatibility notes. That effort serves no one yet, and it keeps old forms alive in the docs and the code.

## Decision

User decision, 2026-10-14. Until real usage is detected:

- **Breaking changes ship without migration paths.** There are no deprecation aliases, compatibility shims or deprecation periods: the old form is removed with the change.
- **The docs describe only the current API.** There are no upgrade guides, no "renamed from" notes and no migration sections.
- **No extra communication of breaking changes** beyond what the tooling already does. Conventional Commit messages, and the changelog that `pnpm release:version` generates from them, stay as they are.

## Consequences

- `docs/upgrading.md` and its index entry are removed (TASK-271).
- The `?component` change (decision-46) drops the bare `.svg` component and `?inline` with no alias.
- This decision is revisited when the framework has real users. From then on, breaking changes need a migration path again.
