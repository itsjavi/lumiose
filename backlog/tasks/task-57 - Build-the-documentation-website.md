---
id: TASK-57
title: Build the documentation website
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-08 15:54'
labels: []
milestone: m-5
dependencies:
  - TASK-26
  - TASK-45
  - TASK-32
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lumen needs a public website for humans and agents: the version-matched markdown in packages/lumen/docs is the single source, and the site itself is built with Lumen (SSG), so it also dogfoods the framework.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 apps/docs is a Lumen SSG site (mode static) rendering packages/lumen/docs markdown, with no duplicated content: navigation, per-page TOC, prev/next, code highlighting incl. .stsx (TSX + CSS + $refs), dark mode, responsive
- [ ] #2 Landing page presenting Lumen's benefits with evidence: .stsx and first-class CSS (placement scopes, $tokens, build-time math via Lightning CSS), performance numbers from the benchmarks (TASK-12/20), islands/SPA/SSG modes, agent-first tooling
- [ ] #3 Client-side search island over a prebuilt index; error pages at /errors/LUMxxxx (the URLs the runtime and compiler print); llms.txt and llms-full.txt served at the root
- [ ] #4 lumen build outputs a static site that works when served statically; lumen check passes; screenshots in backlog/assets
<!-- AC:END -->
