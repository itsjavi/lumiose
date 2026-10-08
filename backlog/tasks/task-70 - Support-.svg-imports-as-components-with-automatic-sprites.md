---
id: TASK-70
title: Support .svg imports as components
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-08 16:20'
updated_date: '2026-10-08 21:21'
labels:
  - needs-decision
milestone: m-3
dependencies:
  - TASK-59
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user decided (2026-10-08) after Halo's study: SVG imports become inline components by default, with query switches, and there is no sprite mode. Halo's measurements showed per-page sprites save raw HTML but not compressed bytes, and <use> renders slower.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 import Icon from "./x.svg" gives an inline SVG component accepting standard SVG props (class, style, width/height, aria-*) plus title (rendered as <title> with aria-labelledby; aria-hidden when no title); works on client and server (SSR) and in islands
- [ ] #2 Query switches: ?inline (explicit default), ?url (asset URL via Vite), ?raw (string); no sprite mode
- [ ] #3 Build-time SVG optimisation (OXVG crate if usable, else SVGO in the Vite plugin), configurable via lumen({ svg: { optimize } }); currentColor-friendly defaults
- [ ] #4 Types for *.svg (and ?url/?raw) in lumen/env; tests; docs (concept page + reference) in the same commits
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implementation per the user's decision (inline only, ?inline/?url/?raw, no sprite mode). OXVG is usable as a Rust crate (oxvg_optimiser/oxvg_ast 0.0.9, MIT, same lightningcss 1.0.0-alpha.72 and cssparser 0.37 as ours), and decision-22 puts the .md/.html pipelines in the Rust compiler reusing the static-template codegen, so: (1) new crate crates/lumen_svg (Halo): parse + OXVG optimise (default preset; prefix_ids per file hash; scripts/event handlers always stripped) -> component source (root attributes static, {...rest} spread, title -> <title id> + role=img + aria-labelledby, aria-hidden when unlabelled), compiled by the existing lumen_compiler for both targets; (2) lumen_napi: compileSvg(source, filename, options) = lumen_svg + lumen_compiler::compile; (3) packages/lumen/src/vite/svg.ts: load hook for project .svg and .svg?inline (Vite keeps ?url/?raw), registered from index.ts, option lumen({ svg: { optimize } }) in options.ts; (4) lumen/env types for *.svg, *.svg?inline, ?url, ?raw; (5) docs: concept page + vite/jsx reference; tests at each layer (Rust unit/golden, napi/vite plugin, SSR+client render).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
STUDY (Halo, 2026-10-08) - SVG imports and automatic sprites. Evidence: scripts and raw results in .local/agents/Halo/halo-20261008T203613Z/ (measure.mjs, results.txt, bench.html).

## Options compared
- A. Inline: each use renders the full `<svg>…paths…</svg>` (what SVGR, unplugin-icons, Solid/Svelte plugins and Astro do).
- B. External sprite: one build asset; each use renders `<svg><use href="/assets/icons-<hash>.svg#id"/></svg>`.
- C. Per-document inline sprite: each icon's `<symbol>` once per HTML response in a hidden `<svg>`; each use renders `<svg><use href="#id"/></svg>`.

## HTML weight (Tabler 3.44 outline icons, SVGO-lite optimised: avg icon body 162 B, avg inline element 346 B; filler prose from our docs)
| Page | Inline raw | C raw | B raw | Inline gzip6 / br11 | C gzip6 / br11 | B gzip6 / br11 |
|---|---|---|---|---|---|---|
| Docs page, 14 uses / 9 icons | 16.5 KB | 13.6 | 11.9 | 4.8 / 4.0 | 4.9 / 4.1 | 4.2 / 3.5 (+0.6 KB br sprite file) |
| Dashboard, 212 uses / 17 icons | 78.4 KB | 36.8 | 36.2 | 3.4 / 2.4 | 3.2 / 2.6 | 2.1 / 1.7 (+1.0 KB) |
| Feed, 510 uses / 15 icons | 213.8 KB | 102.1 | 111.5 | 16.0 / 11.8 | 14.3 / 11.6 | 13.7 / 11.0 (+0.8 KB) |
- Raw HTML: C is 2.1-2.7x smaller than inline on icon-heavy pages (the premise holds for raw bytes).
- Transferred (compressed) HTML: inline and C are within 0.3 KB with brotli and within 1.7 KB with gzip; C is sometimes larger (the `<use href="#id">` per use costs about what the compressor charges for a repeated path). Every production server/CDN compresses HTML, so C does not make pages meaningfully lighter on the wire. B saves 0.6-1.1 KB br per page but adds a request.
- Raw size still matters for: dynamic-compression CPU on SSR servers (roughly proportional to input), HTML parse memory, and DOM node count (inline 1634 vs C 1059 SVG elements on the feed page).

## Rendering cost (Chromium 152, 2000 icons, 15 distinct, median of 9 x 3 rounds; bench.html)
- Inline: 17.0-17.5 ms parse+layout, 27.3-27.9 ms to next frame (685 KB markup).
- `<use>` (C): 21.6-22.3 ms parse+layout, 40.6-41.9 ms to next frame (173 KB markup).
- `<use>` is about 1.3-1.5x slower despite 4x less markup (each use instantiates a shadow tree). Absolute cost is small at realistic counts (about 6 us more per icon). Firefox/Safari not measured.

## Trade-offs
| | A. Inline | B. External sprite | C. Per-document sprite |
|---|---|---|---|
| Caching across pages | No (compressed bytes ~= C) | Yes | No |
| Extra request / blank icons | No | Yes: icons empty until the sprite loads; not render-blocking | No |
| currentColor | Yes | Yes (inherited into the use shadow tree) | Yes |
| CSS on inner parts, animations (spinners, check draw) | Yes (needs :deep()/global since inner elements are the icon component's) | No: only inherited props + custom properties | No: same as B |
| Gradients/clipPath/mask ids | Duplicate ids when repeated (invalid; breaks if the first copy is display:none) | OK | OK if the sprite is hidden with width=0/height=0/position:absolute, NOT display:none/hidden (Chromium/Firefox stop rendering referenced paint servers) |
| Cross-origin assets (CDN base) | OK | Broken: `<use>` has no CORS for external refs | OK |
| SSR + shell streaming | Trivial | Trivial (needs the asset URL from the manifest) | Renderer must collect used icons per request and emit symbols outside island ranges: after `<body>` in the shell (the shell is fully buffered per decision-19, so its icon set is known) and as a top-level `<svg>` before each streamed boundary chunk |
| Islands / hydration | Trivial (static template) | Trivial | Server markup per use is static; symbols must live outside islands (a symbol inside a use site breaks when that site is removed on the client) |
| SPA / client-only / client:only | Trivial | Trivial | Runtime `ensureSymbol(id, markup)` appends missing symbols to a body-level sprite (~250 B runtime); icon markup ships in JS either way |
| HMR | Normal module HMR | Regenerate asset + bust URL | Dev ids from file path; hot update replaces the symbol in place (every use updates) |
| CSP strict | OK | OK | Hidden container needs position:absolute without a style attribute: nonce'd rule or a class in Lumen's base CSS |
| a11y | Same API for all: decorative by default (aria-hidden="true" when no title/aria-label/aria-labelledby); `title` prop renders `<title>` as the outer svg's first child + role="img" (a `<title>` inside `<symbol>` is not exposed reliably through `<use>`, so strip it) | | |
| Complexity | Low (compile svg -> static template) | Medium | High (request-scoped registry, chunk injection, client runtime, CSP, HMR) |

## Prior art
- Astro shipped `mode: "sprite"` for SVG components experimentally (5.0) and removed it when the feature became stable in 5.7 (April 2025): all SVG components are inline; sprite mode "temporarily removed while we consider a new implementation that addresses how this feature was being used in practice".
- SVGR (`?react` suffix since v4, to keep Vite's default URL import), unplugin-icons: inline components.
- Optimiser: OXVG (Rust, SVGO-compatible but not 1:1, pre-1.0 0.0.x, MIT; Parcel reportedly uses it; also @oxvg/napi). Fallback: SVGO in the Vite plugin, cached.

## Recommendation (for the user to decide)
1. Ship `.svg` imports as **inline components by default** (A): same transferred size as a per-document sprite, faster to render, works unchanged with SSR streaming, islands, SPA, hydration and HMR, and keeps full CSS control. The sprite's real win is raw HTML size (2-2.7x on icon-heavy pages), not bytes on the wire.
2. Offer the **per-document sprite (C) as an opt-in mode** (`lumen({ svg: { mode: "sprite" } })` or `?sprite` per import) only if the user still wants leaner raw HTML after seeing these numbers; it is the only automatic sprite that is correct with islands, streaming and SPA, but it is the most complex.
3. Do **not** build the external sprite (B): an extra request with empty icons until it loads, broken with a cross-origin asset `base`, and it saves under 1.1 KB br per page.

## Proposed API (both modes share it)
```ts
import Logo from "./logo.svg";            // component; project default mode (inline)
import Spinner from "./spinner.svg?inline"; // force inline
import Check from "./check.svg?sprite";   // force a sprite reference (if C is approved)
import logoUrl from "./logo.svg?url";     // Vite default behaviours stay available
import logoRaw from "./logo.svg?raw";

<Logo class="logo" width={32} title="Acme" />
```
- Props: every `<svg>` attribute and Lumen prop on the root (`class` with $$scope passthrough, `style`, `width`/`height` defaulting to the file's or its viewBox, `fill`, `stroke`, `aria-*`, `role`, events, `ref`), plus `title?: string`.
- Types in `lumen/env`: `declare module "*.svg" { const Svg: Component<SvgProps>; export default Svg }` plus `*.svg?inline` / `*.svg?sprite`.
- Config: `lumen({ svg: { mode?: "inline" | "sprite", optimize?: boolean | options, include?, exclude? } })`; transform only project files by default (exclude node_modules, where a dependency importing `x.svg` expects Vite's URL).
- Build: optimise (OXVG or SVGO), prefix internal ids with a content hash, warn when an inline icon with internal `url(#id)` references is used (suggest `?sprite`), compile to a static template (no runtime cost beyond a clone).

COORDINATION (Halo, 2026-10-08, per Lux): TASK-70 touches other areas with small, additive edits: crates/lumen_napi/src/lib.rs + Cargo.toml (Photon: one new #[napi] fn compileSvg), packages/lumen/src/vite/{svg.ts (new), index.ts (register the sub-plugin), options.ts (svg option)} (Photon), packages/lumen/src/jsx/env.d.ts (Beacon: *.svg module types), root Cargo.toml [workspace.dependencies]/members (oxvg_*, under deps.lock), docs pages for the feature. Photon/Beacon: please avoid editing those exact spots until TASK-70 is committed; tell Lux if you need them.
<!-- SECTION:NOTES:END -->
