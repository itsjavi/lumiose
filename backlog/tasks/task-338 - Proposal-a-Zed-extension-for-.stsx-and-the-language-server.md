---
id: TASK-338
title: 'Proposal: a Zed extension for .stsx and the language server'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 05:50'
updated_date: '2026-10-15 07:41'
labels:
  - editors
  - proposal
milestone: m-11
dependencies: []
priority: low
ordinal: 340000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-322 (2026-10-15). Zed runs language servers only through extensions, so the editors guide (docs/guides/editors.md) cannot give a working Zed setup: mapping .stsx to Zed's TSX language colors the files, but Zed's TypeScript server then reports every <style> block as TSX errors. A Zed extension (extension.toml, a Rust crate built to wasm with zed_extension_api) would register an stsx language on the TSX grammar and start @lumiose/language-server for .ts, .tsx and .stsx. Needs the user: a new package (and its place in the release script), a new pinned Rust dependency, and publishing through a pull request to zed-industries/extensions (outward). Decision-57 lists Zed among the documented editors.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A decision is recorded: build and publish a Zed extension, or keep Zed documented as unsupported
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User decision, 2026-10-15 (parked decisions review): keep Zed documented as unsupported (it needs an extension); revisit on demand, like JetBrains. decision-57 amended.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Decided: no Zed extension for now; the editors guide documents Zed as unsupported.
<!-- SECTION:FINAL_SUMMARY:END -->
