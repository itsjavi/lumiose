---
id: TASK-312
title: 'Fuzz the CSS, SVG and content crates'
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-15 04:02'
updated_date: '2026-10-15 06:40'
labels:
  - security
  - fuzzing
milestone: m-11
dependencies:
  - TASK-311
priority: medium
ordinal: 314000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-56: cargo-fuzz targets for lumiose_css (style blocks, $ constants, scoping), lumiose_svg (the allowlist sanitizer) and lumiose_content (Markdown, frontmatter and HTML imports, depth limits), with corpora seeded from fixtures, run by the nightly fuzz workflow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Fuzz targets cover lumiose_css, lumiose_svg and lumiose_content with seeded corpora
- [x] #2 The nightly fuzz workflow runs them
- [x] #3 Crashes found while adding them are fixed or tracked as tasks
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Lux, orchestrator): reassigned to Spark for the unattended M10/M11 run. New worker sessions cannot be started from automated turns, and Spark's session was idle with its own queue done; Spark may edit this task's area (crates, CI workflows, release scripts) for it, since no Photon or Halo worker is active.

Spark started 2026-10-15 (batch 5, reassigned).

Implementation (Spark, batch 5):
- fuzz/ targets: css_process (lumiose_css::process on one block; the first byte picks the scope (global, file, component, subtree), minify and source map; $refs resolved to numbers and strings as in tests/robustness.rs), svg_component (lumiose_svg::component_source), content_markdown and content_html (lumiose_content::markdown/html). The nightly workflow picks them up from fuzz/Cargo.toml without changes.
- fuzz/seed.sh now takes extensions per target: css_process from the compiler's .css fixtures and lumiose_css's .stsx fixtures (malformed CSS on purpose), svg_component from lumiose_svg's fixtures, content_markdown from lumiose_content's fixtures and docs/concepts/*.md, content_html from lumiose_content's fixtures.
- Crash found and fixed (AC#3): css_process panicked within seconds on '{r:$calc(1rem - 2rem)}' (subtree scope): the negative-math guard (src/clamp.rs) took the 'calc(' of the constant $calc for a math function and inserted 'max(0rem, ' inside the $ref's replacement, an overlapping edit (a debug_assert in debug builds; in release the guard edit was silently dropped). Math whose start or end falls inside a $ref is now left alone; regression test clamp::tests::leaves_math_names_inside_refs_alone.
- Local runs (stable, -s none): css_process 120 s / 309k runs after the fix, svg_component 4.1M runs, content_markdown 48k, content_html 721k, 60 s each: no other crash.
- CONTRIBUTING.md (target list) and SECURITY.md updated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fuzz targets for lumiose_css, lumiose_svg and lumiose_content (Markdown and HTML), seeded from fixtures and the docs, run by the nightly workflow. The CSS target found an overlapping-edit bug in the negative-math guard ($calc(…) constants), fixed with a regression test.
<!-- SECTION:FINAL_SUMMARY:END -->
