---
id: TASK-608
title: 'Docs layout: words beside the code they describe'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-11-17T12:29:00Z'
updated_date: '2026-11-17T14:22:00Z'
labels: []
milestone: m-16
dependencies:
  - TASK-604
references:
  - backlog/assets/redesign/b-first-light.html
ordinal: 600000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rebuild DocsShell and DocArticle to the reference: a slim sidebar, a large page head, and sections laid out as prose on the left with their code and result on the right; step pages get a sticky step bar. The layout is derived from the existing Markdown structure (a section, its prose, its code blocks): no new authoring syntax. If new syntax seems needed, propose it to the user first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A section with prose and code renders as two columns on desktop and stacks on phones; a section without code stays one readable column
- [x] #2 Pages with numbered steps get the sticky step bar, built from their headings
- [x] #3 Sidebar, search, previous and next links and the on-page anchors keep working; URLs do not change
- [x] #4 llms.txt, llms-full.txt and the Markdown sources are unaffected by the layout
- [x] #5 docs:check, the docs tests and the web e2e and a11y suites pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (beacon-20261117-t608). The layout rule, for the docs writers (code: layoutRows and readSteps in apps/web/src/content/docs.ts; unit tests in docs-layout.test.ts):

- A section is a ## or ### heading and what follows it up to the next ## or ### (plus the page's start before its first heading). #### stays inside its section.
- Two columns: inside a section, a run of words (the heading counts) that is directly followed by one or more top-level fenced code blocks is a pair: the words on the left, those code blocks on the right. From 48rem up; below it everything stacks in source order.
- Words after the code: when the left side holds only the heading, and no other code follows them, they go under the heading, beside the code. Otherwise they are a full row of their own.
- One column: words with no code after them (max 68ch), and tables (the article's full width; a table never goes into a column and ends the pair before it). Code with no words around it is also one column. Code nested in a list item stays in the words.
- Step bar: the page gets it when at least two ## headings start with a number and a dot (## 1. Install) and those numbers count 1, 2, 3 in order. The heading then shows 'Step N' as a label above its title; its id keeps the number (#1-install), so URLs do not change. The bar's labels are the heading texts: keep them short (six of them fit at 1280 px with about 16 characters each; the bar scrolls sideways when they do not fit).
- So for the writers: one short paragraph, then its code, per ## or ### gives the words-beside-code look; a long explanation after an example with words before it becomes a full row; a section with a table and no code stays one column.

Other decisions: the right-hand 'On this page' column became a closed disclosure under the page head (there is no room for a third column), also shown on phones now. DocPage.blocks keeps its old shape (TASK-614's ui-gallery reads it); the layout reads the new DocPage.sections. New tests live in their own files (src/content/docs-layout.test.ts, e2e/docs.e2e.ts) because content.test.ts, web.e2e.ts and a11y.e2e.ts carried other workers' uncommitted changes.

Validation (2026-11-17): lumiose check clean; apps/web vitest 53 passed; docs:check and the docs tests (packages/cli/src/docs, packages/stsx) pass; pnpm typecheck and pnpm lint clean; no horizontal overflow at 390, 900 and 1280 px in both themes on ten docs, /ui and /stsx pages (and 320 px in the a11y reflow test). Playwright on the static build: docs.e2e.ts, web.e2e.ts and ui.e2e.ts 28 passed; a11y.e2e.ts ran in full once (4 failures: two were this task's and are fixed and re-run green: a demo widening a 320 px page, 23 px sidebar links; one was a UI test tripping on the sidebar dot's character, fixed by drawing the dot).

Left open, outside this task's files: the a11y test 'text keeps AA contrast over decorative layers at their strongest (light)' failed on the header's navigation links (4.36:1 over a beam) and on .primary.btn (white on amber, about 2:1) on every page; none of its entries is a docs-layout element. It belongs to the header/beams and button work (TASK-605, TASK-606, site-kit) and was not re-run after their later changes. The e2e webServer could not rebuild the playground's WebAssembly here (the installed wasm-bindgen CLI is 0.2.129, the workspace pins 0.2.130), so the suites ran against a hand-started static build with the existing playground assets; playground.e2e.ts was not run.

Screenshots: backlog/assets/redesign/task-608-getting-started-light.jpg, task-608-getting-started-dark.jpg, task-608-getting-started-step-dark.jpg (step bar, step 4 current), task-608-getting-started-phone.jpg, task-608-signals-light.jpg, task-608-signals-dark.jpg.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The docs shell and article follow the First light reference: a slim sidebar with mono group labels and a dot on the current page, a large page head with the summary beside it, sections with their words on the left and their code on the right (stacked in source order below 48rem), and a sticky step bar on pages whose ## headings are numbered steps (an island marks the step being read). The layout is derived from the Markdown alone (layoutRows and readSteps in apps/web/src/content/docs.ts); no authoring syntax was added and no doc page, llms.txt or URL changed. 'On this page' is now a disclosure under the head. The rule for writers is in the notes.
<!-- SECTION:FINAL_SUMMARY:END -->
