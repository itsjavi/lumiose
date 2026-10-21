---
id: TASK-488
title: Extract both chiptune apps into itsjavi/dotmatrix
status: In Progress
assignee:
  - '@Chime'
created_date: '2026-10-20 21:22'
updated_date: '2026-10-21 01:38'
labels: []
milestone: m-13
dependencies:
  - TASK-485
  - TASK-487
priority: medium
ordinal: 484000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-73 (revised 2026-10-21): one public MIT repository, a pnpm workspace with apps/pocket (examples/spa-dotmatrix, Dotmatrix Pocket) and apps/advanced (examples/spa-chiptune, formerly Lumiose Chip), keeping both histories (git filter-repo of both paths, moved to their app folders); apps/pocket-react comes with TASK-491. Depends on lumiose 0.5.0+ and gbapu from npm. Setup: what npm create lumiose writes (AGENTS.md, Lumiose skill), CLAUDE.md pointing to AGENTS.md, README pointing to the Lumiose backlog for old TASK ids, MIT LICENSE, oxlint, oxfmt, Vitest, Playwright, a CI workflow and Renovate. Ask the user before creating the repository.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The user approved creating the repository
- [ ] #2 github.com/itsjavi/dotmatrix exists, public, with apps/pocket and apps/advanced and the history of both examples
- [ ] #3 CI passes for both apps
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Chime (2026-10-21): prepared the dotmatrix workspace locally; no GitHub repository, remote or push yet (waits for the user's approval).
- History: git subtree split of examples/spa-dotmatrix and examples/spa-chiptune in a scratch clone, then git subtree add into apps/pocket (31 commits) and apps/advanced (27 commits); 65 commits in all. Imported commit messages and diffs contain no local paths. With subtree, git blame follows files into the app folders, but git log -- apps/<app> shows only the import commit (the old commits keep their root-relative paths).
- Root: package.json (pnpm -r scripts, check), pnpm-workspace.yaml, tsconfig.base.json, trimmed .oxlintrc.json/.oxfmtrc.json, .gitignore, .gitattributes, MIT LICENSE, README, .github/workflows/ci.yml (actions pinned to Lumiose's SHAs), .github/renovate.json, AGENTS.md/CLAUDE.md/.claude/skills/lumiose from create-lumiose (spa) with a workspace section.
- Apps: @dotmatrix/pocket and @dotmatrix/advanced on lumiose ^0.5.0; Lumiose Chip renamed to Dotmatrix Advanced (title, pixel logo, import error, README), Dotmatrix to Dotmatrix Pocket (title, header, guide, README); driver/dialect names, storage keys and the song file format id unchanged. Pages e2e (playwright.pages.config.ts, tests-pages) removed (TASK-489). vendor/gbapu kept until gbapu is on npm.
- Verification: npm still has lumiose 0.4.0, so no install or lockfile yet (CI needs pnpm-lock.yaml). Pre-check against this checkout's packages (scratch copy, not committed): lumiose check, Vitest (pocket 225, advanced 10), lumiose lint (0 errors; advanced 7 warnings, pre-existing), fmt check, build and Chromium e2e (pocket 66, advanced 28) all pass.
- Remaining: pnpm install + lockfile commit and a full run once 0.5.0 is on npm; then create the repository (AC #1-#3).

Chime (2026-10-21, follow-up): rewrote the imported histories with git filter-branch (paths moved under apps/pocket and apps/advanced) and rebuilt main as the root commit, two --allow-unrelated-histories merges and the replayed commits (identical final tree). git log -- apps/pocket shows 32 commits, apps/advanced 28, git log --follow works on app files, no local paths in any message. pnpm-workspace.yaml now excludes lumiose, @lumiose/* and gbapu from the minimum release age. 66 commits; still no install (0.5.0 not on npm), remote or push.
<!-- SECTION:NOTES:END -->
