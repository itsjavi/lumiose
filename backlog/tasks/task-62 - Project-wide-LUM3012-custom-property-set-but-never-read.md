---
id: TASK-62
title: Project-wide LUM3012 (custom property set but never read)
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 16:01'
updated_date: '2026-10-09 04:20'
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
- [x] #1 compile() exposes custom properties set in style props (name, span) and the custom properties read by the file's CSS
- [x] #2 A project-wide check reports LUM3012 only for properties no stylesheet of the project reads; fixtures for cross-file reads
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-09): compile() meta.customProperties = { set: [{ name, span }] (style prop object keys "--x" and --x: declarations of style strings, on elements and components; UTF-16 spans via napi), read: sorted var() names of the file's CSS (empty when css is null) }. lumen/vite (src/vite/custom-properties.ts CustomPropertyCheck): records every module compile of the build and the var() reads of every other stylesheet (pre transform of css/scss/less/... ids, incl. dependencies), and warns LUM3012 with file/line at buildEnd of the last environment (server in an SSR app, client in an SPA). Not in dev. Beacon follow-up (not done, outside my area): lumen check / LS can reuse CustomPropertyCheck (module(file, source, result) + stylesheet(id, code) for plain .css files, then unread()). Tests: lumen_compiler unit + compile_api; src/vite/custom-properties.test.ts (real client build: only the typo is reported; reads from own CSS, a child component's CSS fed by a style string, and app.css are honoured). Docs: errors/LUM3012.md, concepts/styles.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LUM3012 is reported project-wide by lumen build: compile() exposes meta.customProperties (set with spans, CSS reads) and lumen/vite reports the custom properties no stylesheet of the build reads. lumen check/LS integration left to Beacon (noted).
<!-- SECTION:FINAL_SUMMARY:END -->
