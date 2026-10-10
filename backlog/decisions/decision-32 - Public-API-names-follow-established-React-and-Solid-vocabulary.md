---
id: decision-32
title: Public API names follow established React and Solid vocabulary
date: '2026-10-10 03:32'
status: accepted
---
## Context

On 2026-10-10 the user found Lumiose's API hard to learn: similar patterns use different, sometimes invented, words. For example `createContext` (React/Solid) sits next to `provide`/`inject` (Vue/Angular), and names such as `lifetime()` and `busy()` have no counterpart users already know. The user's direction: "we shouldnt invent our own words if the users already know some pattern/api in solid or react", while staying accurate and not misleading.

## Decision

- Public API names reuse the vocabulary users already know from React and Solid (and, for data fetching, TanStack Query), as long as the name describes what our API really does.
- When our semantics differ from the known API (for example a setup-once `inject` versus a re-rendering `useContext`), pick a name that does not promise the other library's behaviour, and document the difference.
- Invent a name only when no known API matches, and say so in the docs.
- Renames and new public names are syntax/DX decisions: the user approves them (decision-16).

## Consequences

- TASK-190 audits every public export against this rule and proposes renames; TASK-191 applies the approved ones.
- New primitives (doc-6: scoped state, the async cache, optimistic updates) keep provisional names until the audit settles the vocabulary.
