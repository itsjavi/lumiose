---
id: TASK-486
title: 'itsjavi.com port: switch to ?client and record its scorecard'
status: In Progress
assignee:
  - '@Lux'
created_date: '2026-10-20 21:22'
updated_date: '2026-10-21 07:24'
labels: []
milestone: m-13
dependencies:
  - TASK-485
priority: medium
ordinal: 482000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Move the itsjavi.com port's theme toggle, search and other small scripts from islands to ?client once 0.5.0 is on npm, then record its scorecard against the Astro site in doc-11: JavaScript per page, requests, build time, source lines and what got easier or harder (decision-70).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The port uses ?client wherever it used an island only for a small script
- [x] #2 doc-11 holds the itsjavi.com scorecard with numbers and DX notes
- [x] #3 Gaps found become tasks in this backlog
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Worker session (Lux, standalone worker started by the orchestrator) took TASK-486 on 2026-10-21: upgrade the itsjavi.com port to lumiose 0.5.0, move its small-script islands to ?client, re-run parity and re-measure.

2026-10-21, worker session (Lux): done in the port's repository (local commits only, not pushed: it has no remote yet).

- **Upgrade.** lumiose, @lumiose/vite, @lumiose/cli and @lumiose/adapter-node 0.5.0 from npm (minimumReleaseAgeExclude entries bumped). The upgrade alone built and passed every check: no spreads write srcdoc/innerHTML there and the inline head scripts have no closing tags. `lumiose agents init` refreshed the managed block.
- **?client (AC #1).** Theme toggle, search, screenshot viewer, copy button, giscus comments and CodePen embeds are now server components rendering custom elements (src/elements/*.ts, imported with ?client), with data in attributes typed in JSX.IntrinsicElements (copy text, discussion term, screenshots as JSON). The search renders every result on the server so they keep their scoped styles. Wrappers use display: contents. Only the live editor stays an island: tabs, collapse, title, preview, export data and storage status follow one reactive document state, and its runtime is small next to CodeMirror's 195 kB. Typed ?client arguments (decision-71) were not needed.
- **Parity.** Visual diff against the Astro build (same release data on both): 64 shots, mean 0.02%, max 0.21%, no height differences (one regression found and fixed: a `.bar > :deep(.theme)` child rule). Behaviour checks 11/11 (new: arrow keys, dark-theme label, lazy giscus/CodePen, and a body sent after a 400 ms pause so definitions load before the children). Reload scroll jump 0/30 (Astro 13/30), confirming TASK-278.
- **JS per page (gzip, files + inline).** 0.4.0 islands 13.5-14.8 kB; 0.5.0 islands 13.8-15.0 kB; 0.5.0 ?client 1.7-2.4 kB; Astro 1.3-1.7 kB. Editor 203.4 vs Astro 190.3 kB. Requests +2..+4 vs Astro; totals lighter than Astro on every page but the editor. Builds 4.7/2.2 s vs Astro 4.3/2.3 s (cold/warm); check 1.2 vs 5.8 s; 175 vs 433 packages.
- **Scorecard (AC #2):** doc-11 itsjavi.com section; full tables in the port's FINDINGS.md. Evidence image: backlog/assets/task-486-home-parity.webp (Astro, Lumiose, pixel diff).
- **Gaps (AC #3):** TASK-517 (?client elements can connect before their children; docs example duplicates text; unscoped script-created elements), TASK-518 (agent guidance still says only islands), TASK-519 (proposal: inline or combine small ?client scripts), TASK-520 (Astro docs page quotes 0.4.0 numbers).
- **Waits on the user:** creating the port's remote, pushing it and deploying it to itsjavi.com. The Astro site's release cache was replaced with the port's so both builds show the same releases (a cache under node_modules; nothing committed there).
<!-- SECTION:NOTES:END -->
