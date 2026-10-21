---
id: doc-11
title: Port scorecards
type: other
created_date: '2026-10-20 21:23'
updated_date: '2026-10-21 07:24'
---
Every port of a real project records a scorecard against its original stack here (decision-70). Lumiose's public claims come from these scorecards and the benchmarks, so a port where Lumiose is not clearly better on something that matters is written down as plainly as a win, and its gaps become tasks.

## How to score a port

- **Same content, same machine.** Build both versions from the same content and data, on the same machine, with the production build of each. Write down the machine, Node version and each stack's versions.
- **Measure built output, not dev mode.** Sizes are brotli unless noted. Count per page type, such as home, a content page, or the most interactive page.
- **Count source lines the same way on both sides.** Count hand-written code and styles only. Leave out content (Markdown, data), generated files and tests, and list tests separately.
- **Keep the DX notes concrete.** "Moving the search box into an island took no rewrite" is useful; "nicer DX" is not.

## Template

```markdown
## <Project>: <scope of the port>

- Original: <stack and versions>. Lumiose: <version>. Date: <YYYY-MM-DD>. Machine: <cpu, os, node>.
- Port: <repository or folder by name>. Task: TASK-<id>.

| Metric                           | Original | Lumiose | Notes |
| -------------------------------- | -------: | ------: | ----- |
| JavaScript per page (brotli)     |          |         |       |
| CSS per page (brotli)            |          |         |       |
| Requests per page                |          |         |       |
| Build time, cold / warm          |          |         |       |
| Runtime (interaction, INP, etc.) |          |         |       |
| Source lines (code + styles)     |          |         |       |
| Runtime dependencies             |          |         |       |

**Easier in Lumiose:** ...

**Harder in Lumiose:** ...

**Gaps found:** TASK-<id>, ...
```

## Scorecards

### itsjavi.com: the whole site

- Original: Astro 7.3.8 with Tailwind 4.3 (static output, small scripts inlined). Lumiose: 0.5.0 (static mode, six `?client` scripts and one island). Date: 2026-10-21. Machine: Apple M1 Max, macOS 27, Node 26.8.1, pnpm 12.4.2.
- Port: its own repository, not deployed yet; its FINDINGS.md holds the full tables, produced by its comparison, visual-diff and behaviour scripts. Task: TASK-486 (the first measurement, on 0.4.0, produced TASK-278 to TASK-290).
- Sizes are gzip, as GitHub Pages serves them. Ranges cover the home, listing, project, post and about pages, at first load (1280×800, no scroll); the editor page is noted apart. Both builds used the same content and cached release data.

| Metric                             |             Astro |           Lumiose | Notes                                                                                                                                                                            |
| ---------------------------------- | ----------------: | ----------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JavaScript per page (gzip)         |        1.3–1.7 kB |        1.7–2.4 kB | Script files plus inline scripts. With islands it was 13.5–15.0 kB (0.4.0 and 0.5.0). Editor page: 190.3 vs 203.4 kB, CodeMirror plus Lumiose's runtime and the editor island    |
| CSS per page (gzip)                |        7.2–9.0 kB |        3.2–6.6 kB | Astro sends its whole Tailwind build to every page                                                                                                                               |
| HTML per page (gzip)               |        4.9–8.7 kB |        4.4–6.9 kB |                                                                                                                                                                                  |
| Total per page, first load         |                   |                   | Lumiose is lighter on every page but the editor: home 135.4 vs 132.6 kB, about 19.2 vs 15.9 kB                                                                                   |
| Requests per page                  |              5–21 |              7–24 | 2 to 4 more: one per `?client` script, which Astro inlines (TASK-519), and a third stylesheet on some pages                                                                      |
| Build time, cold / warm            |       4.3 / 2.3 s |       4.7 / 2.2 s | Medians of 3. 0.4.0: 5.9 / 3.4 s (TASK-288)                                                                                                                                      |
| Runtime (interaction, INP, etc.)   |                   |                   | Not measured: static pages with small scripts on both sides. Reload of a scrolled page jumps 13/30 times on Astro, 0/30 on Lumiose (18/30 on 0.4.0, TASK-278)                    |
| Type check                         |             5.8 s |             1.2 s | `astro check` vs `lumiose check`                                                                                                                                                 |
| Dev server, cold start / next page |     2.0 s / 49 ms |     4.7 s / 36 ms | Lumiose resizes every image on the first request (TASK-279)                                                                                                                      |
| Source lines (code + styles)       | 4,655 in 47 files | 5,745 in 57 files | Lumiose carries a content layer, image helpers, prose styles and sitemap endpoints that Astro and Tailwind provide. Tests not counted: the port's behaviour checks are 251 lines |
| Runtime dependencies               |    14 (23 direct) |     8 (17 direct) | Fresh install: 433 vs 175 packages, 293.5 vs 170.7 MB                                                                                                                            |
| Parity                             |                   |                   | 64 full-page screenshots differ by 0.02% of pixels on average, 0.21% at most, no height differences; 11/11 behaviour checks pass                                                 |

**Easier in Lumiose:**
- Content: native Markdown imports and a frontmatter hook gave an Astro-like, zod-validated content layer in about 150 lines.
- Styles: scoped `<style>` blocks with build-time tokens and `light-dark()` replaced Tailwind with 17–56% less CSS per page.
- Small scripts: a `?client` import ships a component's script only to the pages that render it, bundled and without the runtime, and the custom element's attributes are type-checked where the server writes them (Astro's scripts read `data-*` untyped). The copy button's text, the comments' term and the gallery's screenshots all went through attributes; typed `?client` arguments (decision-71) were not needed.
- Reactive UI: the live editor stays one component (signals, JSX, an island) instead of Astro's hand-written DOM script.
- Checks: `lumiose check` runs in 1.2 s instead of 5.8 s, routes are typed, and LUM2001 and LUM3005 caught real mistakes (values frozen from props, styles left without elements).
- Toolchain: 175 installed packages instead of 433, TypeScript 7, two config files instead of four.

**Harder in Lumiose:**
- Small scripts as custom elements took 226 more lines than as islands across six components (836 to 1,062). Each element needs its `JSX.IntrinsicElements` declaration, and the gallery and search do with DOM calls what signals and JSX did.
- The scripts must not expect an element's children in `connectedCallback`, since an `async` definition can load before the parser adds them (the docs' example breaks then), and elements a script creates are unscoped: the search renders its results on the server instead (TASK-517).
- Each small script is a request, where Astro inlines them (TASK-519).
- No image pipeline: vite-imagetools with literal globs, 44 more image files, and a 4.7 s dev cold start (TASK-279).
- No collections API or frontmatter-only imports, no Markdown hooks or typographic quotes, no sitemap or redirects options, and precompressed copies GitHub Pages ignores (TASK-280, TASK-281, TASK-287, TASK-286).
- Scoping covers only a selector's last part (TASK-282), and LUM2001 warns in components that only render on the server (TASK-290).
- The agent guidance that `lumiose agents init` writes still says only islands ship JavaScript (TASK-518).

**Gaps found:** TASK-279, TASK-280, TASK-281, TASK-282, TASK-286, TASK-287, TASK-290, TASK-517, TASK-518, TASK-519, and TASK-520 (the Astro docs page still quotes the 0.4.0 numbers). Closed since the 0.4.0 port: TASK-278 (reload scroll jump), TASK-283 (small scripts without the runtime), TASK-284 (event replay, documented), TASK-285 (CSS sharing), TASK-288 (build time), TASK-289 (WebAssembly compiler install).

**Status:** measured on 0.5.0. The port's push and deployment to itsjavi.com wait on the user.

### Dotmatrix Pocket: Lumiose vs idiomatic React

- Original: the Lumiose app (lumiose 0.5.0, a prerendered SPA). Port: React 19.3 with the React Compiler 1.0, React Router 8.5 (data mode, lazy routes), Zustand and Immer, CSS modules, MDX. Both on Vite 8.3 and gbaudio 1.0, the same driver, model, demo songs and CSS. Date: 2026-10-21. Machine: Apple M1 Max, Node 26.8.
- Port: github.com/itsjavi/dotmatrix (apps/pocket and apps/pocket-react); the full scorecard and DX notes are in its README ("Lumiose vs React"). Task: TASK-491.

| Metric                                     |                         Lumiose |                          React | Notes                                                   |
| ------------------------------------------ | ------------------------------: | -----------------------------: | ------------------------------------------------------- |
| JavaScript, first load (studio/songs/learn) |           50.8 / 36.8 / 32.6 kB |       125.7 / 107.9 / 103.2 kB | Lumiose's runtime 17.7 kB; React + React DOM 56.8 kB    |
| CSS, first load                             |             10.1 / 7.1 / 7.1 kB |            10.5 / 8.1 / 7.6 kB |                                                         |
| Requests, first load                        |                    13 / 11 / 11 |                     10 / 9 / 8 |                                                         |
| Studio first load, slow 4G + 4x CPU         | shows 0.70 s, interactive 1.50 s | shows and interactive 3.01 s | Lumiose prerenders every page                           |
| Build, cold / warm                          |                   1.22 / 1.19 s |                  1.59 / 1.60 s | The Babel React Compiler takes about 1.0 s              |
| Interactions                                |                            same |                           same | Within 1-2 ms on every measured interaction             |
| Source lines (code + styles)                |                           5,669 |                          5,867 |                                                         |
| Runtime dependencies (direct)               |                               5 |                              9 |                                                         |

**Easier in Lumiose:** first paint (prerendered pages), reactivity without stale state in handlers, fine-grained updates without splitting components for the playhead, the DOM's own change events, and scoped element selectors.

**Harder in Lumiose:**
- Hydration: browser-saved state (the open song, preferences) loads after mount so the first client render matches the prerendered HTML. The songs gallery (18 kB of prerendered HTML) becomes interactive at 2.8 s on the slow profile, slightly later than React's 2.7 s (TASK-515).
- Share links: React Router's `loader` opens `?song=` before the studio renders; Lumiose reads it in `onMount`.
- Undo: Immer's immutable songs make history cheap; the Lumiose store snapshots the song on every edit.
- Ecosystem: React had a ready answer for every need (MDX, Zustand, Immer, lint rules) and familiar docs.

**Gaps found:** TASK-515.

### A private app: list and detail (planned)

TASK-492. The scorecard names the stacks and the numbers, not the app.

### The same app: forms, actions and auth (later)

TASK-493.
