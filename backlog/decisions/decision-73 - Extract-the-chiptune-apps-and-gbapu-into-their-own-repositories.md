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

Approved by the user on 2026-10-20 and revised on 2026-10-21: one repository for both apps instead of two. The work becomes two public repositories under the author's GitHub account, both MIT:

- **`itsjavi/gbapu`**, published to npm as `gbapu`. It holds the engine's TypeScript source, taken from the crystal-exporter tool of the pokemon-time-crystal project, with tests, types and a build. It starts with a fresh history.
  - **Provenance** (confirmed by the user on 2026-10-21): the APU emulation (`src/gbapu.ts`) is a TypeScript port of stoneface's C++ gbapu (github.com/stoneface86/gbapu, MIT, 2020). Its MIT notice is in LICENSE and the README credits it. The audio compiler, token tables and WAV export are the author's.
  - **Name:** the user kept the unscoped name `gbapu`. The package description and README say it is a TypeScript port of stoneface86/gbapu, with an audio compiler.
  - **Formatting:** the engine files are formatted with the package's oxfmt settings. The package is their source of truth from now on.
- **`itsjavi/dotmatrix`**, a pnpm workspace with three apps. It keeps the history of both examples, moved to their new folders:

  | App                  | From                                       | GitHub Pages path      |
  | -------------------- | ------------------------------------------ | ---------------------- |
  | `apps/pocket`        | examples/spa-dotmatrix (Dotmatrix Pocket)  | `/dotmatrix/`          |
  | `apps/pocket-react`  | the React port with its scorecard (decision-70) | `/dotmatrix/react/` |
  | `apps/advanced`      | examples/spa-chiptune (formerly Lumiose Chip) | `/dotmatrix/advanced/` |

  One Pages deployment holds the three builds. The root `404.html` hands paths below `/react/` and `/advanced/` to that app's own SPA shell, as the Lumiose site does for its showcase. `pocket` and `pocket-react` depend on `gbapu` from npm.

The repositories get:
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
- Redirects the old showcase URLs to the new pages: `/showcase/dotmatrix/` to `/dotmatrix/`, and `/showcase/chiptune-tracker/` to `/dotmatrix/advanced/`, keeping the rest of the path, the query and the hash (Dotmatrix share links carry the song in `?song=…`).

## Consequences

- Lumiose's CI loses its two largest apps as build checks. Each new repository's own CI builds against the latest `lumiose` through Renovate, so a break shows up there, at no extra cost here.
- Commit messages carried over mention Lumiose TASK ids, so each README points to the Lumiose backlog.
- Creating each repository and publishing `gbapu` wait for the user's go-ahead.
- The Chime agent's area leaves this repository with the apps.
