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

**Decision records require explicit user approval**
- A decision record (`accepted`) is created only after the user explicitly approves the choice, with phrasing such as "yes", "let's do it", or "use X".
- Exploratory questions ("would X be possible?", "why not Y?") are not approval.
- Unapproved options live in chat or in the spec as proposals.

**Legacy exception.** Decisions 5–10 were recorded as `proposed` before this rule existed. They stay until the user decides whether to approve, change or remove them.

## Consequences

- The backlog history sits alongside the code history.
- An auto-commit may include anything already staged, so agents avoid backlog mutations while the index holds entries they did not stage.
- Recording decisions takes an extra confirmation round-trip, but the decision log reflects only choices the user owns.

