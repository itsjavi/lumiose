---
id: TASK-212
title: 'One positioning line across README, docs, llms.txt, site and package.json'
status: Done
assignee:
  - Beacon
created_date: '2026-10-10 22:41'
updated_date: '2026-10-11 01:39'
labels:
  - docs
  - positioning
milestone: m-7
dependencies: []
priority: high
ordinal: 214000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-37 (positioning, approved by the user 2026-10-11; notes in .local/positioning/): replace the four different one-liners with the tagline "Feels like React. Runs like vanilla JS." and the descriptor "Lumiose is a web framework for every kind of web app, from static sites to SPAs: TSX with scoped CSS built in, signals, and 0 kB of JavaScript where pages don't move." Surfaces: README.md and packages/lumiose/package.json description (Lux-owned files: coordinate), packages/lumiose/docs/README.md and the generated llms.txt/llms-full.txt, apps/web site.ts (tagline, description, landing title), and create-lumiose template texts that describe Lumiose. "TypeScript-first" leaves the one-liners; TypeScript stays as a proof point where relevant.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every listed surface uses the same tagline and descriptor
- [x] #2 No one-liner still says 'TypeScript-first' (checked with a grep)
- [x] #3 pnpm --filter lumiose docs:gen has run and docs:check and the docs tests pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon 2026-10-11: tagline + descriptor applied to README.md (first lines, Lux-authorized), packages/lumiose/package.json description (Lux-authorized), docs/README.md summary (+ tagline line), regenerated llms.txt/llms-full.txt, apps/web site.ts (tagline used by the footer, description used by meta/og) and the landing <title> (`Lumiose: <tagline>`). The AGENTS.md snippet written by `lumiose agents init`/create-lumiose now opens with the descriptor; create-lumiose templates have no other text describing Lumiose. The landing tooling bullet 'TypeScript-first, compatible with TypeScript 7' became 'TypeScript 7, typed from routes to CSS' (proof point, decision-37). git grep -i typescript-first outside backlog/: no hits. Checks: docs:gen, docs:check, vitest (cli, create, web, docs tests: 123 passed), lumiose check (web), web e2e 9 passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
One positioning line everywhere: 'Feels like React. Runs like vanilla JS.' plus the decision-37 descriptor in README, package.json, docs index, llms.txt, site meta/footer/title and the agent snippet. No 'TypeScript-first' left.
<!-- SECTION:FINAL_SUMMARY:END -->
