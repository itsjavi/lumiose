---
id: TASK-169
title: 'Security: compiler/CSS/SVG depth limits and SVG sanitizer allowlist (TASK-162)'
status: In Progress
assignee:
  - Halo
created_date: '2026-10-09 12:10'
updated_date: '2026-10-09 12:46'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
RESUME (Halo, 2026-10-09 checkpoint). Committed d4465d9: lumen_svg allowlist (src/allow.rs: elements in SVG case, attributes + aria-*/data-*), foreignObject/unknown/dotted elements dropped, SMIL checks case-insensitive incl. values/from/to/by and on*/style targets, <style> text escapes < and & (\\3c, \\26), depth limit 128 checked by a pre-parse tag scan (roxmltree recurses), non-ASCII attr panic gone (allowlist); tests crates/lumen_svg/tests/security.rs; svg.md allowlist docs; frontmatter __proto__ emitted as computed key (content.ts + test). All Prism SVG repros neutralised (run-svg.mjs, optimize true/false). UNCOMMITTED in the working tree (not yet green, intentionally left): (1) lumen_css: prepass MAX_NESTING=64 for blocks and parens -> LUM3014 and block skipped (prepass.rs, process.rs too_deep); LUM3021 unsafe $ constant values ({ } ; outside strings, <, comments, unterminated strings, trailing escape) (process.rs unsafe_value, diagnostics.rs); values.rs refs-per-declaration via binary search (100k refs: 5 s -> 0.23 s); tests tests/depth.rs and tests/unsafe_refs.rs NOT yet run green: the_deepest_nesting_allowed_compiles (64 nested blocks) is very slow in debug, probably exponential nesting lowering in Lightning CSS: next step is to time 8..24 nested blocks in release, lower MAX_NESTING for blocks (e.g. 16-24) if growth is exponential, then run cargo test -p lumen_css. (2) lumen_content: limits.rs (MAX_NESTING 512 HTML tag-scan + markdown quote markers) -> LUM1009, lib.rs wiring, tests/limits.rs (green). (3) registry.rs: my lines LUM1009 + LUM3021 sit next to Photon's LUM1010 (TASK-170): commit mine via a temporary index from HEAD. (4) docs: errors/LUM1009.md, LUM3021.md (written), LUM3014 nesting note, security.md 'Files from elsewhere' section; regenerate docs in a HEAD worktree so README/llms do not include Photon's LUM1010. Then rebuild bindings, rerun Prism's fuzz harness (fuzz/scale.mjs, parent.mjs) and repros css2.mjs/fm.mjs, and finish ACs.
<!-- SECTION:NOTES:END -->
