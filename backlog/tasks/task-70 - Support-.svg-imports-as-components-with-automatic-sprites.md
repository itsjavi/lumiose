---
id: TASK-70
title: Support .svg imports as components with automatic sprites
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-08 16:20'
updated_date: '2026-10-08 20:56'
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
The user wants SVG imports as components (almost every modern app needs icons), handled as a separate study: find a way to support SVG sprites automatically so the final HTML stays much leaner than inlining every icon.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Study recorded in the task notes: inline SVG components vs external sprite sheets (<use href='sprite.svg#id'>) vs inline per-page sprite (<svg hidden><symbol>… once per document), with HTML weight, caching, CSS styling (currentColor), SSR/islands/SPA behaviour and a11y trade-offs; recommendation for Lux/user
- [ ] #2 Implementation per the approved recommendation: import Icon from './x.svg' gives a component accepting standard SVG props; the build dedupes repeated icons into a sprite automatically; SVGO-style optimisation (Rust if available); types; tests; docs
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Study only (AC #1); implementation (AC #2) waits for the user's decision. 1) Read how Lumen compiles JSX templates, SSR, islands and the CSS manifest to see where an SVG transform and a sprite collector would plug in. 2) Measure HTML weight on a realistic page (a real icon set, e.g. lucide/heroicons-sized paths, ~30 icon uses with repeats): inline per use vs per-document inline sprite vs external sprite, raw and gzip/brotli. 3) Compare caching, currentColor/CSS styling, SSR/islands/SPA navigation/streaming, a11y, HMR, CSP/cross-origin, browser quirks. 4) Propose API shape (import Icon from './x.svg', props, ?url/?raw variants, types) and a recommendation for the user. Scratch in .local/agents/Halo/halo-20261008T203613Z/.
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
<!-- SECTION:NOTES:END -->
