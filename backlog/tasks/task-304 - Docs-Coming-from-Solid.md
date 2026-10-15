---
id: TASK-304
title: 'Docs: Coming from Solid'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-15 02:22'
labels:
  - docs
milestone: m-10
dependencies:
  - TASK-301
priority: low
ordinal: 306000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A guide for Solid and SolidStart developers, following the shared outline. Solid is the closest model (setup-once components and fine-grained signals, decision-3), so the guide focuses on differences: createSignal, createMemo and createEffect → signal, computed and effect (decision-32 and decision-35); props and destructuring (compiler idioms, decision-7); control-flow components (Show, For) and their Lumiose equivalents; createResource and Suspense → async components; stores → store(); context; .stsx files and style blocks; server-first rendering with islands versus SolidStart's SSR; SolidStart file routes, server functions and actions → file routes, endpoints and form actions; Solid Router → lumiose/router.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The guide covers every mapping above, with type-checked examples
- [ ] #2 Solid features without an equivalent are listed with the recommended alternative
- [ ] #3 docs:gen, docs:check and the docs tests pass
<!-- AC:END -->
