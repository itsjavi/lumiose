---
id: doc-11
title: Port scorecards
type: other
created_date: '2026-10-20 21:23'
updated_date: '2026-10-21 02:01'
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

### Dotmatrix Pocket: Lumiose vs idiomatic React (planned)

TASK-491, after the extraction (TASK-488).

### A private app: list and detail (planned)

TASK-492. The scorecard names the stacks and the numbers, not the app.

### The same app: forms, actions and auth (later)

TASK-493.
