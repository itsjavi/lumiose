---
id: doc-11
title: Port scorecards
type: other
created_date: '2026-10-20 21:23'
updated_date: '2026-10-21 06:00'
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

### itsjavi.com: the whole site (in progress)

- **Status:** the first port runs on lumiose 0.4.0. Its findings so far became TASK-278 to TASK-290.
  - With TASK-285 (decision-68), visiting every page dropped from 12 CSS requests and 29.2 kB to 8 requests and 15.3 kB.
  - With TASK-288, the build takes 1.95 s, against 2.03 s for the Astro site.
  - Pages with an island still load about 13 kB gzip of island runtime, where the Astro site's inline scripts were 1-2 kB (TASK-283).
- **Next:** TASK-486 switches its small scripts to `?client` after 0.5.0 and records the full scorecard here.

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
