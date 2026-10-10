---
id: TASK-212
title: 'One positioning line across README, docs, llms.txt, site and package.json'
status: To Do
assignee:
  - Beacon
created_date: '2026-10-10 22:41'
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
decision-37 (positioning, approved by the user 2026-10-11; notes in .local/positioning/): replace the four different one-liners with the tagline "Feels like React. Runs like vanilla JS." and the descriptor "Lumiose is a web framework for every kind of web app, from static sites to SPAs: TSX with first-class CSS, signals, and 0 kB of JavaScript where pages don't move." Surfaces: README.md and packages/lumiose/package.json description (Lux-owned files: coordinate), packages/lumiose/docs/README.md and the generated llms.txt/llms-full.txt, apps/web site.ts (tagline, description, landing title), and create-lumiose template texts that describe Lumiose. "TypeScript-first" leaves the one-liners; TypeScript stays as a proof point where relevant.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every listed surface uses the same tagline and descriptor
- [ ] #2 No one-liner still says 'TypeScript-first' (checked with a grep)
- [ ] #3 pnpm --filter lumiose docs:gen has run and docs:check and the docs tests pass
<!-- AC:END -->
