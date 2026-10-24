---
id: TASK-561
title: 'Proposal: SVG icon sprites (site-kit or a Vite option) and the icons guide'
status: To Do
assignee:
  - Lux
created_date: '2026-10-24 15:34'
labels:
  - site-kit
  - docs
  - proposal
dependencies: []
priority: low
ordinal: 553000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From a port (2026-10-24): icon-heavy lists use one hashed sprite file (imported with ?url) and an <Icon id> component that renders <svg><use href>, which is far lighter than inline ?component icons repeated per row. guides/icons.md only covers inline icons. Options: a site-kit Icon + a sprite build helper, a Vite option that builds a sprite from a folder or an icon set, or a docs recipe only. Public API for the first two: needs the user's approval.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The user chose an approach (or declined), recorded in a decision or the guide
<!-- AC:END -->
