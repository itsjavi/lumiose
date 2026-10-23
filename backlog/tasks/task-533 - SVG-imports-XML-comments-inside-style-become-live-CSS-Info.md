---
id: TASK-533
title: 'SVG imports: XML comments inside <style> become live CSS (Info)'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-23 18:09'
updated_date: '2026-10-23 19:54'
labels:
  - security
dependencies: []
priority: low
ordinal: 526000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
0.6.0 delta review: crates/lumiose_svg/src/emit.rs:296 takes roxmltree's text() of <style>, which includes comment content, so commented-out CSS comes alive. Not a bypass (the filter reads the merged text). Filter children with is_text().
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Comments inside an SVG <style> are dropped, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (session halo-a9eb2b59, 0.6.1 cleanup batch, worktree branch): claimed and started.

Halo: crates/lumiose_svg/src/emit.rs now takes only the text children of <style> (filter is_text(); CDATA is text in roxmltree). roxmltree's text() also returns a comment's content and an element's first text child, so both used to become CSS. New security test comments_inside_style_are_not_css (comments between rules and inside a value, an element child, CDATA kept, a comment-only <style> stays empty); it fails on the old code. svg.md says only text and CDATA are CSS. Validation: cargo test -p lumiose_svg, cargo fmt --check, cargo clippy -p lumiose_svg --all-targets -D warnings, pnpm build:compiler, the vite svg vitest files, docs:check, pnpm typecheck, pnpm lint (no new warnings). Full pnpm check not run: Lux asked to keep the machine quiet for a perf measurement.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
An imported SVG's <style> keeps only its text and CDATA as CSS, as a browser reads it: XML comments (and child elements) inside it no longer become live CSS. Security test added; svg.md updated. Commit 5f6f238a (with TASK-532).
<!-- SECTION:FINAL_SUMMARY:END -->
