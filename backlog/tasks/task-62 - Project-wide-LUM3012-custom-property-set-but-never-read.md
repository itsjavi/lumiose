---
id: TASK-62
title: Project-wide LUM3012 (custom property set but never read)
status: To Do
assignee: []
created_date: '2026-10-08 16:01'
labels: []
dependencies:
  - TASK-45
priority: low
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lumen_css can report LUM3012 per file, but TASK-45 does not run it: a custom property set in a style prop (style={{ "--accent": c }}) is often read by another file's CSS (a child component, global CSS), so a per-file check gives false positives. A project-wide check needs every file's set properties (span) and the union of var() reads across all stylesheets (lumen_css CssOutput.custom_properties_read, plus plain .css files). Candidates: lumen check (all files) and/or the Vite plugin at buildEnd. compile() would need to expose the set properties and reads in meta.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 compile() exposes custom properties set in style props (name, span) and the custom properties read by the file's CSS
- [ ] #2 A project-wide check reports LUM3012 only for properties no stylesheet of the project reads; fixtures for cross-file reads
<!-- AC:END -->
