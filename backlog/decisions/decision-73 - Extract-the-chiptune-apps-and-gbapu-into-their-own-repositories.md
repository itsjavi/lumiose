---
id: decision-73
title: Extract the chiptune apps and gbapu into their own repositories
date: '2026-10-20 21:20'
status: accepted
---
## Context

Two sample apps are complete products, and the website builds both into its showcase:

- **Dotmatrix** (examples/spa-dotmatrix): 12.6k lines, with the gbapu engine vendored as a build.
- **Lumiose Chip** (examples/spa-chiptune): 6.4k lines.

gbapu is the author's Game Boy APU engine. Its LICENSE-NOTICE records that it was vendored without a license.

## Decision

Approved by the user on 2026-10-20. The work becomes three public repositories under the author's GitHub account, all MIT:

- **`itsjavi/gbapu`**, published to npm as `gbapu`. It holds the engine's TypeScript source, taken from the crystal-exporter tool of the pokemon-time-crystal project, with tests, types and a build. It starts with a fresh history.
- **`itsjavi/dotmatrix-pocket`**, from examples/spa-dotmatrix, keeping its history. It is a small pnpm workspace: the Lumiose app plus `ports/react`, the React port with its scorecard (decision-70). It depends on `gbapu` from npm.
- **`itsjavi/dotmatrix`**, from examples/spa-chiptune (formerly Lumiose Chip), keeping its history.

Each repository gets:
- What `npm create lumiose` writes: AGENTS.md and the Lumiose skill.
- A CLAUDE.md pointing to AGENTS.md.
- A README and a LICENSE.
- oxlint and oxfmt; Vitest and Playwright.
- A GitHub Actions workflow that checks the project and deploys it to GitHub Pages.
- Renovate.

Each depends on `lumiose` from npm, 0.5.0 or later.

After the extraction, this repository:
- Removes examples/spa-dotmatrix and examples/spa-chiptune.
- Links its showcase to the new repositories and their Pages.
- Redirects the old showcase URLs (`/showcase/dotmatrix/`, `/showcase/chiptune-tracker/`) to the new pages.

## Consequences

- Lumiose's CI loses its two largest apps as build checks. Each new repository's own CI builds against the latest `lumiose` through Renovate, so a break shows up there, at no extra cost here.
- Commit messages carried over mention Lumiose TASK ids, so each README points to the Lumiose backlog.
- Creating each repository and publishing `gbapu` wait for the user's go-ahead.
- The Chime agent's area leaves this repository with the apps.
