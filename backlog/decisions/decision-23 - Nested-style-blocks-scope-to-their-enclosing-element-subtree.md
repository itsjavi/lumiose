---
id: decision-23
title: Nested style blocks scope to their enclosing element subtree
date: '2026-10-08 20:34'
status: accepted
---
## Context

Decision-14 scoped a `<style>` inside a component to the whole component, wherever it was placed. While authoring in VS Code, the user expected a `<style>` nested deep in the JSX to apply only to the part of the tree that encloses it. For example, with A → B1 → C1 and A → B2 → C2 → `<style>`, C1 should not get C2's styles. They chose subtree scoping on 2026-10-08.

## Decision

The scope ladder is now:

| Placement | Scope |
|---|---|
| A `<style>` inside a component's JSX | Its enclosing element and every element lexically inside it, within that component |
| A `<style>` placed directly under the component's root element | Effectively the whole component |
| Top level of the file | The whole file |
| `<style global>` | The whole app |

- **Lexical rule.** The style covers what is written inside the enclosing element in the source. That includes JSX passed as children to components inside the subtree, which keeps the author's tokens. It does not cover other components' own templates.
- **Class passthrough.** A call site passes the caller's applicable tokens: the enclosing-subtree chain plus the file token.

## Consequences

- The compiler issues one token per style-bearing element and stamps it on that element's lexical subtree. The runtime is unchanged.
- Editor completion offers classes from the enclosing styles, the file, and globals. It does not offer classes from sibling subtrees.
- HTML grows slightly, by one attribute per element inside a nested style's subtree.
