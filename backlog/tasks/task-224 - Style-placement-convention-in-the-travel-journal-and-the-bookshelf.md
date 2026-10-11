---
id: TASK-224
title: Style placement convention in the travel journal and the bookshelf
status: Done
assignee:
  - Nova
created_date: '2026-10-11 01:24'
updated_date: '2026-10-11 01:59'
labels:
  - styles
  - example
milestone: m-6
dependencies: []
priority: medium
ordinal: 226000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-40 (user 2026-10-11): teach and use one top-level <style> at the end of the file by default, shared by every component in it; nested blocks only to scope one element's subtree or to read a component-local $constant. The docs show and explain both placements. Apply it to examples/ssg-travel-journal (14 files with <style>, all nested) and examples/ssr-bookshelf (19 files, 9 nested).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each .stsx file uses one top-level <style> at the end of the file by default; every remaining nested block scopes an element subtree or reads a component-local constant
- [x] #2 Rendering is unchanged: tests and e2e pass, and before/after screenshots of the main pages match (watch for selectors that now reach other components in the same file)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-11): every nested <style> in both apps moved to one top-level block at the end of its file, in source order (travel journal: 14 files, including the root layout's <style global>; bookshelf: the 9 files with nested blocks; its 10 route files already had a file-level block at the end). No nested block remains: none read a component-local constant or needed subtree scoping once selectors were checked.
- Leaks checked per multi-component file. Journal Site.stsx: the footer's bare p, a and a:hover would have reached the header (a:hover on the brand link), so they now start from .site-footer. Bookshelf Header.stsx: footer p qualified as .site-footer p for the same reason (no element matched yet). BookCard (Cover/BookCard/BookGrid), Rating (Rating/Stars), PostCard (PostGrid/PostCard), posts/[slug] and tags/[tag] (wrapper pages without elements): no selector matches another component's elements.
- Evidence: Playwright full-page screenshots of the main pages at 1280 and 390 px, plus hover states (journal: home, page 2, post, tags, tag, archive, about, 404, brand and footer link hover; bookshelf: home, books, books page 2, book, authors, author, genres, genre, about, login, brand and card hover, and signed-in home, book, reading list, profile and books). Before and after builds on the same seeded DB are byte-identical (18 journal and 32 bookshelf images; the before set was shot twice to confirm determinism). Representative: backlog/assets/task-224-journal-home.png, backlog/assets/task-224-bookshelf-book.png.
- Also updated the Styles sections of both READMEs and the journal's about page wording (text only, after the comparison).
- Validation: lumiose check, lumiose fmt --check, vitest (journal 11, bookshelf 69) and Playwright e2e (journal 17, bookshelf 16) all green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The travel journal and the bookshelf follow decision-40: one file-level <style> at the end of each file, shared by its components. Selectors that would have reached another component in the same file now start from that component's root class (.site-footer). Rendering is unchanged: before/after screenshots of every main page (desktop, phone, hover, signed in) are byte-identical, and both apps' unit and e2e suites pass.
<!-- SECTION:FINAL_SUMMARY:END -->
