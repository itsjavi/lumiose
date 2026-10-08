---
id: decision-16
title: 'Backlog workflow: tracked in the main repo, decisions only after user approval'
date: '2026-10-08 11:34'
status: accepted
---
## Context

Originally, `backlog/` was ignored by the main repository and had its own Git repository. The user changed this on purpose: `backlog/` is now tracked in the main repository, and they asked for backlog changes to be committed as part of the regular workflow (2026-10-08).

The user also objected when a decision was recorded before they had approved it. That record came from an exploratory question about `fallback` props.

## Decision

**Backlog in the main repository**
- `backlog/` is tracked by the main repository.
- The Backlog CLI auto-commits its own changes.
- Agents commit any remaining backlog changes as part of normal work, for example hand-edited decision bodies, which the CLI cannot write.
- Agents never reset, clean or rewrite backlog history.
- AGENTS.md ("Backlog in the repository") is the operational source for these rules.

**Who approves which decisions** (amended 2026-10-08 by the user: "you can decide about everything else, I only wanted to decide about the syntax and DX")
- **Syntax and developer-experience decisions require explicit user approval.** These cover authoring syntax, public API shape, file formats, and what developers write or see.
  - Record such a decision only after an explicit "yes", "let's do it", "use X", or a selected option.
  - Exploratory questions ("would X be possible?", "why not Y?") are not approval.
  - Until approval, keep options as proposals in chat or in the spec.
- **All other decisions are delegated to the architect (Lux).** This covers technical, architecture, performance, tooling-internals and process decisions. Lux records them as `accepted` with their rationale, guided by the goals: performance, TS 7-first, ecosystem compatibility and agent-first DX.
  - If a technical choice would change something developers write or see, it goes back to the user.

## Consequences

- The backlog history sits alongside the code history.
- An auto-commit may include anything already staged, so agents avoid backlog mutations while the index holds entries they did not stage.
- Recording decisions takes an extra confirmation round-trip, but the decision log reflects only choices the user owns.

