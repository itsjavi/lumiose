---
id: TASK-169
title: 'Security: compiler/CSS/SVG depth limits and SVG sanitizer allowlist (TASK-162)'
status: In Progress
assignee:
  - Halo
created_date: '2026-10-09 12:10'
updated_date: '2026-10-09 12:11'
labels:
  - security
  - css
  - svg
  - content
milestone: m-7
dependencies: []
priority: high
ordinal: 169000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prism TASK-162 (repros in .local/agents/Prism/prism-20261009T1200Z/{compiler,fuzz}/): H1 deep nesting crashes the host with a native stack overflow — lumen_css nesting walk/Lightning CSS calls and lumen_svg node() recursion (Photon does scanner/oxc); H2 SVG sanitizer bypasses: innerHTML attribute inside foreignObject → DOM prop, entity-decoded '<' in <style> breaks out of SVG foreign content, foreignObject HTML (iframe srcdoc, base, meta refresh) unfiltered, dotted tag names (<process.exit/>) compile to JS calls, SMIL drop is case-sensitive — switch to element/attribute allowlists, drop foreignObject content, attributes as plain strings, reject invalid/dotted names, escape '<' in style text, case-insensitive SMIL + values/from/to/by checks; L1 CSS $ constant values can break out of placement scoping — error on invalid substituted values / reject {,},;,< outside strings; L2 panic on non-ASCII attribute name (emit.rs:100); L3 quadratic parsing (md nested quotes, html unclosed divs, many ); L4 frontmatter __proto__ sets the prototype (emit ["__proto__"]).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Depth limits return diagnostics (regression tests at depth 100k) in lumen_css and lumen_svg
- [ ] #2 Every SVG repro is neutralised; allowlist documented in svg.md; L1–L4 fixed with tests; fuzz harness rerun clean
<!-- AC:END -->
