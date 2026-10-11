---
id: decision-40
title: 'Style placement convention: one file-level style block by default'
date: '2026-10-11'
status: accepted
---
## Context

Where a `<style>` block sits decides its scope (decisions 14 and 23):

- **Inside a component's JSX:** the block styles the enclosing element's subtree.
- **At the file's top level:** it styles every template in the file, and it can read any top-level `const` declared before it.
- **`<style global>`:** it styles the whole app.

The language has always supported file-level blocks. Almost nothing we ship uses them, as counted on 2026-10-11:

| Where | Files with `<style>` | Files with a nested block |
| --- | --- | --- |
| create-lumiose templates | 9 | 9 |
| The website | 11 | 11 |
| The travel journal | 14 | 14 |
| Dotmatrix | 21 | 19 |
| The chiptune tracker | 16 | 12 |
| The styles docs page | 7 samples | 6 samples |

Authors and coding agents copy what they see, so nesting became the de facto style. It costs readability: the CSS is indented inside the JSX. It also hides the fact that one block can serve every component in a file.

## Decision

Approved by the user on 2026-10-11, as a DX convention.

- **The default is one top-level `<style>` at the end of the file.** Every component defined in the file shares it.
- **Nested blocks stay valid and documented.** We teach two uses for them:
  - scoping one element's subtree
  - reading a constant declared inside a component
- **The docs show and explain both placements.** The styles page leads with the file-level block shared by several components, then covers nested blocks and when to choose them.
- **The convention lives in teaching material:**
  - the docs and `llms.txt`
  - the AGENTS.md snippet and the skill written by `lumiose agents init`
  - the create-lumiose templates
  - the landing and playground samples
- **No lint rule.** Nesting is not an error.
- **Everything we ship moves to the convention:**
  - the website
  - `@lumiose/site-kit`
  - every example project

## Consequences

- Tasks:
  - TASK-220 (Beacon): docs, agent guidance, templates and the website.
  - TASK-221 (Halo): `@lumiose/site-kit`.
  - TASK-222 (Spark): the chiptune tracker and the Vite counter.
  - TASK-223 (Chime): Dotmatrix.
  - TASK-224 (Nova): the travel journal and the bookshelf.
- **Moving a block from a component root to the file level widens its scope** to every template in the file. Each refactor checks that no selector starts matching another component in the same file, with before/after screenshots.
- **TASK-222 and TASK-223 touch the same files as the prerender tasks** (TASK-217, TASK-218). Each is done first or in the same session.
