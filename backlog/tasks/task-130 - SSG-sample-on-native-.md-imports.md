---
id: TASK-130
title: SSG sample on native .md imports
status: Done
assignee:
  - Halo
created_date: '2026-10-09 04:26'
updated_date: '2026-10-09 04:38'
labels:
  - samples
  - content
dependencies:
  - TASK-129
priority: low
ordinal: 130000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-38 finding 8: examples/ssg-travel-journal/src/content.ts reimplements Markdown with marked + yaml. Migrate posts to native .md imports (frontmatter hook, headings for the TOC). Lux authorises edits in examples/ssg-travel-journal for this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The sample drops marked/yaml; posts are .md imports; TOC uses headings; its Playwright suite passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (2026-10-09): posts are native .md imports (lumen({ md: { frontmatter } }) in vite.config.ts). src/frontmatter.ts postFrontmatter() validates the fields (same rules and messages as before, minus the file prefix the plugin now adds) and adds readingMinutes from the file's body; src/posts.d.ts merges the fields into lumen/env's Frontmatter (named posts.d.ts: content.d.ts would be shadowed by content.ts). content.ts maps the glob modules to Post { ...frontmatter, slug, Content, headings (depth 2) }; the post page renders <props.post.Content /> and the TOC from headings; rss.xml renders bodies with renderToString (lumen/server). Dropped: marked, yaml (package.json + lockfile importer entry) and the hover '#' anchor links inside headings (native .md has ids, no anchor links; .anchor CSS removed). Heading ids unchanged for every post (GitHub slugs; no duplicates). Validation: vitest (11), lumen check, oxlint, lumen build (31 files), Playwright 16/16.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The SSG sample uses native .md imports: frontmatter validated by the lumen({ md }) hook, TOC from headings, RSS bodies via renderToString; marked and yaml are gone. Unit tests, lumen check and the 16 Playwright tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
