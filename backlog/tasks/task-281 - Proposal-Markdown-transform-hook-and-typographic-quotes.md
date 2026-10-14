---
id: TASK-281
title: 'Proposal: Markdown transform hook and typographic quotes'
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-14 03:47'
labels:
  - proposal
  - content
dependencies: []
priority: low
ordinal: 283000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the itsjavi.com port to Lumiose 0.4.0 (the port's FINDINGS.md), gap 4. Markdown has no extension point: no remark/rehype-style plugins, no typographer (Astro converts straight quotes by default), no syntax highlighting, and the content plugin reads .md files from disk in its own load hook, so other Vite plugins cannot preprocess them. The port accepted straight quotes; a workaround that rewrote the generated .md.stsx module worked but depended on its format. Options: a transform option for the Markdown source or the produced HTML, an opt-in typographer flag, or documenting the limit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision is recorded (and the docs say what Markdown cannot be extended with)
<!-- AC:END -->
