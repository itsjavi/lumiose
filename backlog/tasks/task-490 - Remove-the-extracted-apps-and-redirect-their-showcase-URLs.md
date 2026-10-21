---
id: TASK-490
title: Remove the extracted apps and redirect their showcase URLs
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-20 21:23'
updated_date: '2026-10-21 05:37'
labels: []
milestone: m-13
dependencies:
  - TASK-489
priority: medium
ordinal: 486000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-73: delete examples/spa-dotmatrix and examples/spa-chiptune, point the showcase at itsjavi/dotmatrix and its Pages, redirect /showcase/dotmatrix/ to /dotmatrix/ and /showcase/chiptune-tracker/ to /dotmatrix/advanced/ (keeping the rest of the path, the query and the hash), and update the demo script and its tests, README, .github/CONTRIBUTING.md, AGENTS.md, agents.json (Chime) and the launch configuration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both examples are gone and nothing in the repository references them
- [x] #2 The old showcase URLs redirect to the new pages in the built site
- [x] #3 pnpm check passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (worker started by Lux) takes it on its worktree branch; Lux merges it.

Nova, 2026-10-21, on its worktree branch (Lux merges it):
- Removed examples/spa-dotmatrix and examples/spa-chiptune, and their pnpm-lock importers. Left on purpose: CHANGELOG and backlog history, and the old paths as redirect sources.
- Redirects (scripts/site.ts): showcase/dotmatrix/ and examples/spa-dotmatrix/ go to https://itsjavi.com/dotmatrix/; showcase/chiptune-tracker/ and examples/spa-chiptune/ go to https://itsjavi.com/dotmatrix/advanced/. The existing mechanism does it: a stub at each old root plus the root 404.html script, keeping the rest of the path, the query and the hash. Without JS, a meta refresh and a canonical link. The site no longer builds the apps (scripts/site-mounts.ts). LUMIOSE_PAGES, which only spa-chiptune read, is gone.
- Showcase (apps/web/src/content/showcase.ts): Dotmatrix Pocket and Dotmatrix Advanced cards link the live pages and the apps' folders in itsjavi/dotmatrix. The page lead names their repository. public/showcase/dotmatrix-advanced.png, taken from the Dotmatrix Advanced build, replaces chiptune-tracker.png, which showed the old Lumiose Chip name. Evidence: backlog/assets/task-490-showcase-apps.png.
- Also updated: the demo runner's comments and tests, the size:apps default (spa-router-e2e replaces spa-chiptune), README, CONTRIBUTING, AGENTS.md, agents.json (Chime), .claude/launch.json, docs/concepts/rendering-modes.md (llms regenerated) and the pages.yml comment.
- Validation: pnpm check green. node --test scripts/*.test.ts: 49/49. docs:check green. pnpm build:site --base /lumiose/ ok. Through preview:site, a browser check covered 10 old URLs, including ?song= share links and #hashes: all land on the new URLs, and the stubs carry the refresh, canonical and noindex tags. apps/web e2e: 187 passed (all redirect and showcase tests), 1 failed. The failure is web.e2e.ts's landing test: it expects an older Astro note sentence than content/stacks.ts has. It predates this task and is unrelated.
- Remaining: merge. After TASK-489 deploys the dotmatrix Pages, confirm that https://itsjavi.com/dotmatrix/ and /dotmatrix/advanced/ are live, and that an old /lumiose/showcase/dotmatrix/?song=… link plays there. Then mark Done.
<!-- SECTION:NOTES:END -->
