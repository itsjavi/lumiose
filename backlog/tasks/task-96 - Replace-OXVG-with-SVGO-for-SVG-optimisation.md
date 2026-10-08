---
id: TASK-96
title: Replace OXVG with SVGO for SVG optimisation
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-08 21:46'
updated_date: '2026-10-08 21:49'
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
- [ ] #1 lumen_svg drops OXVG (keeps parsing, sanitisation, id prefixing, template generation); SVGO runs in packages/lumen/src/vite/svg.ts before compileSvg, configurable via lumen({ svg: { optimize: boolean | SvgoConfig } }); same output safety guarantees
- [ ] #2 Native binary size back to about the pre-TASK-70 size (report before/after); tests and goldens green; docs/concepts/svg.md and reference updated in the same commits
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. lumen_svg without OXVG: parse with roxmltree and emit in one pass; always strip scripts, on* handlers, javascript: URLs (also <set>/<animate> that animate href to one), <title>, foreign namespaces; xlink:href -> href; prefix ids (l<hash>__id) and their references (href, url(#), begin/end, aria idrefs, <style> selectors/urls via a cssparser token walk); classes prefixed when the file has a <style> (only names the file uses). API: component_source(svg) (no options). 2. napi compileSvg(source, filename, { target, root }). 3. svg.ts: SVGO 4 (lazy import) before compileSvg; lumen({ svg: { optimize: boolean | SvgoConfig, currentColor } }); default plugins convertStyleToAttrs + preset-default + convertStyleToAttrs; currentColor appends convertColors { currentColor: true }; SVGO parse errors keep file:line:col. 4. svgo dependency in packages/lumen (deps.lock). 5. Tests (Rust goldens, robustness, vite) + docs (concepts/svg.md, reference/vite.md, llms). 6. Measure release binary before/after.
<!-- SECTION:PLAN:END -->
