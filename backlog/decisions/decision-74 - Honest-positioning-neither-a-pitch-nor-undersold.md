---
id: decision-74
title: 'Honest positioning, neither a pitch nor undersold'
date: '2026-10-20 21:20'
status: proposed
---
## Context

decision-37 aims Lumiose at React and Next.js developers who build with coding agents, and puts a stack comparison table under the hero. decision-70 makes Lumiose a research and showcase project whose claims come from port scorecards.

That table lists Astro's client speed as "Depends on the UI framework", even though the fullstack benchmark's Astro app uses Preact islands.

## Decision

The user approved the direction on 2026-10-20. The wording still waits for approval.

- **Tone.** Less marketing and more honest, without underselling. Lumiose is a working framework, built and maintained by one person with coding agents, and its claims come from benchmarks and from ports of real projects.
- **Astro's row** in the comparison says what was measured: Astro with Preact islands. The user approved this change on 2026-10-20.
- **A "Coming from Astro" page** joins the guides for React, Next.js, React Router and Solid. The user approved this on 2026-10-20.

Once the wording is approved, this decision supersedes decision-37 and is marked accepted.

## Consequences

The README, the landing page, meta tags, llms.txt, the docs index and the package descriptions all change together, once the wording is approved.
