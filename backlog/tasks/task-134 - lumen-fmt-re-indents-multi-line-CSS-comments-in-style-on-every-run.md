---
id: TASK-134
title: lumen fmt re-indents multi-line CSS comments in <style> on every run
status: Done
assignee:
  - Beacon
created_date: '2026-10-09 04:35'
updated_date: '2026-10-09 04:46'
labels:
  - fmt
  - tooling
dependencies: []
priority: medium
ordinal: 134000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-124: lumen fmt is not idempotent for a multi-line /* … */ comment inside a <style> block (examples/ssg-travel-journal _layout.stsx and posts/[slug].stsx, before TASK-124's workaround): each run adds indentation to the comment's continuation lines, so lumen fmt --check never passes. The samples now use one-line comments; restore the multi-line comments once fixed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumen fmt is idempotent for multi-line CSS comments in <style> blocks, with a regression test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon: formatCss dedents the block's CSS by the leading whitespace its lines share (the <style> line's own text excepted, $ ref offsets remapped) before oxfmt, which keeps a comment's continuation lines verbatim; stitch then indents once, so relative comment indentation is stable. Regression test in fmt.test.ts (JSX-nested and top-level blocks, comment inside a rule). pnpm fmt:examples passes. Restoring the multi-line comments in examples/ssg-travel-journal (_layout.stsx, posts/[slug].stsx) is left to the example's owner (Nova/Spark).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen fmt is idempotent for multi-line CSS comments in <style> blocks.
<!-- SECTION:FINAL_SUMMARY:END -->
