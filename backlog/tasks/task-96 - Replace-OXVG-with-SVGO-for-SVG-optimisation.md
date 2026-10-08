---
id: TASK-96
title: Replace OXVG with SVGO for SVG optimisation
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-08 21:46'
updated_date: '2026-10-08 21:58'
labels: []
milestone: m-3
dependencies:
  - TASK-70
priority: high
ordinal: 96000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bundling OXVG grew the native compiler from 11.7 MB to 18.1 MB (gzip 3.66 to 5.96 MB) because of its geometry dependencies. Lux chose SVGO in the Vite plugin instead: it is the ecosystem standard, configurable, and keeps the native binary lean.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumen_svg drops OXVG (keeps parsing, sanitisation, id prefixing, template generation); SVGO runs in packages/lumen/src/vite/svg.ts before compileSvg, configurable via lumen({ svg: { optimize: boolean | SvgoConfig } }); same output safety guarantees
- [x] #2 Native binary size back to about the pre-TASK-70 size (report before/after); tests and goldens green; docs/concepts/svg.md and reference updated in the same commits
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. lumen_svg without OXVG: parse with roxmltree and emit in one pass; always strip scripts, on* handlers, javascript: URLs (also <set>/<animate> that animate href to one), <title>, foreign namespaces; xlink:href -> href; prefix ids (l<hash>__id) and their references (href, url(#), begin/end, aria idrefs, <style> selectors/urls via a cssparser token walk); classes prefixed when the file has a <style> (only names the file uses). API: component_source(svg) (no options). 2. napi compileSvg(source, filename, { target, root }). 3. svg.ts: SVGO 4 (lazy import) before compileSvg; lumen({ svg: { optimize: boolean | SvgoConfig, currentColor } }); default plugins convertStyleToAttrs + preset-default + convertStyleToAttrs; currentColor appends convertColors { currentColor: true }; SVGO parse errors keep file:line:col. 4. svgo dependency in packages/lumen (deps.lock). 5. Tests (Rust goldens, robustness, vite) + docs (concepts/svg.md, reference/vite.md, llms). 6. Measure release binary before/after.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
IMPLEMENTED (Halo, 2026-10-08). lumen_svg no longer depends on OXVG: one roxmltree pass emits the component and always strips scripts, on* handlers, javascript: URLs (now also with leading control chars/tabs inside the scheme, and on any attribute), <set>/<animate> of href, <title>, comments/PIs/doctype, foreign-namespace markup; xlink:href -> href, xlink:show -> target. New src/prefix.rs: ids -> l<hash>__id and their references (href/xlink:href #id, url(#id) in any attribute and in <style> via a cssparser 0.37 token walk (same version Lightning CSS ships, no size cost), begin/end id.event, ARIA idrefs); references to ids the file does not define stay (they point at the page); class names prefixed only when the file has a <style>, and selectors only for names the file uses (a class the page adds still matches). API: component_source(svg) (no options); napi compileSvg(source, filename, { target, root }). Vite (svg.ts): SVGO 4.1 (lazy import) runs before compileSvg; lumen({ svg: { optimize: boolean | SvgoConfig, currentColor } }); default plugins convertStyleToAttrs + preset-default + convertStyleToAttrs (currentColor = preset convertColors override); custom config kept (datauri dropped), currentColor prepends convertColors; optimize:false skips SVGO. An SvgoParserError falls back to compileSvg on the raw file (roxmltree's positioned error, or a warning if it parses). svgo ^4.1.0 added to packages/lumen dependencies (deps.lock), lockfile hunks committed with it.
SIZE: release napi binary 18,142,224 B -> 11,816,480 B (gzip -9 5.96 MB -> 3.72 MB); pre-TASK-70 was 11,700,528 B (remaining +116 KB = lumen_svg/roxmltree plus the working tree's other uncommitted compiler changes). Cargo.lock drops ~650 lines (oxvg, geo, rayon, spade, i_overlay, regex, ...).
TESTS: lumen_svg goldens regenerated (monochrome/unoptimized fixtures removed: optimisation/currentColor now belong to SVGO and are tested in svg.test.ts; new styled.svg covers <style> ids/classes/urls, begin, aria refs, xlink:show, <set href>, java&#9;script:); robustness adds hostile CSS (unclosed url/:is, 80 nested parens). svg.test.ts: custom SVGO config + currentColor server, svgoConfigOf unit tests, option validation. Runs: cargo test --workspace 0 failures, clippy --workspace 0 warnings, fmt clean; pnpm test 992 passed / 1 failed (build.test.ts TASK-98, another agent's in-progress work, unrelated); pnpm typecheck clean; pnpm lint 0 errors in my files; docs:check OK.
DOCS: concepts/svg.md (SVGO, custom config example, what is always removed, currentColor + custom config, removeViewBox pitfall), reference/vite.md, options.ts comment, llms regenerated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
SVG optimisation moved from OXVG (Rust) to SVGO in the Vite plugin: lumen({ svg: { optimize: true | SvgoConfig | false, currentColor } }). lumen_svg keeps parsing, sanitisation (scripts, handlers, javascript: URLs, href animations), id/class prefixing with reference rewriting (now including <style> selectors and url() via cssparser) and component emission. Native binary 18.1 MB -> 11.8 MB (gzip 5.96 -> 3.72 MB). Tests and docs updated.
<!-- SECTION:FINAL_SUMMARY:END -->
