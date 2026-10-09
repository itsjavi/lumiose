---
id: TASK-108
title: Reject <script> in Markdown imports
status: Done
assignee:
  - Halo
created_date: '2026-10-09 04:03'
updated_date: '2026-10-09 04:15'
labels:
  - content
  - diagnostics
dependencies: []
priority: medium
ordinal: 108000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-09 (decision-22 amendment): <script> is not supported in .md files. Only .html imports run scripts. TASK-69 currently loads Markdown <script>s like .html ones.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A <script> element in a .md file (raw HTML block or inline) is a build/dev error with a registered LUM diagnostic, file and line, pointing to an .html import or a component; .html behaviour is unchanged
- [x] #2 Tests in lumen_content and the Vite plugin; docs (concepts/content.md, errors/<id>) updated in the same commit; docs:gen/docs:check green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (2026-10-09): lumen_content's markdown() finds <script> start tags in comrak's HtmlBlock/HtmlInline nodes (outside comments and script contents; code spans/blocks are not HTML nodes) and maps them back to byte offsets in the file (frontmatter and container markers included). Each is a LUM1008 error (registered in lumen_compiler's registry, 1xxx file format), exposed as ContentSource.diagnostics by lumen_napi; the Vite content plugin fails the module load with the .md file as id and loc (line/column). Markdown drops <script> elements from the markup; .html is unchanged. Edits outside Halo's area (approved): crates/lumen_compiler/src/diagnostics/registry.rs (one line), crates/lumen_napi/src/lib.rs (diagnostics field), packages/compiler/index.d.ts (generated), packages/lumen/src/vite/content.ts(+test). Validation: cargo test -p lumen_content, registry tests, clippy, fmt; vitest vite/content + cli/docs; lumen typecheck; oxlint; docs:gen/docs:check.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A <script> in a Markdown import is now a LUM1008 build/dev error at the tag's file and line, with help pointing to an .html import or a component; the script is dropped from the markup. .html imports keep their scripts. Docs: concepts/content.md and errors/LUM1008.md.
<!-- SECTION:FINAL_SUMMARY:END -->
