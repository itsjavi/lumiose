---
id: decision-74
title: 'Honest positioning, neither a pitch nor undersold'
date: '2026-10-20 21:20'
status: accepted
---
## Context

decision-37 aims Lumiose at React and Next.js developers who build with coding agents, and puts a stack comparison table under the hero. decision-70 makes Lumiose a research and showcase project whose claims come from port scorecards.

That table lists Astro's client speed as "Depends on the UI framework", even though the fullstack benchmark's Astro app uses Preact islands.

## Decision

The user approved the direction and the wording on 2026-10-20 (TASK-483).

- **Tone.** Less marketing and more honest, without underselling. Lumiose's claims come from benchmarks and from ports of real projects.
- **Landing hero.**
  - The H1 "The best of every stack, in one framework" becomes "One component model, from static pages to full-stack apps" (the user's wording; the draft said "to SPAs").
  - The lead: "Write components in TSX with their styles in the same file. Each route picks how it renders, and a component becomes interactive where you use it, with no rewrite."
  - The eyebrow, the tagline ("Feels like React. Runs like vanilla JS.", backed by the client benchmark), the descriptor, the meta description and the README stay as they are.
- **No status line.** The user declined a "one developer with coding agents" line in the hero and the README. The pre-release badge, the Stability page and When not to use say it.
- **Astro's row** in the comparison says what was measured: Astro with Preact islands (TASK-482).
- **A "Coming from Astro" guide** joins the guides for React, Next.js, React Router and Solid (TASK-481).
- **Port scorecards get a public page** at `/benchmarks/ports/`, filled from committed data (decision-70).

This amends decision-37's hero. Its audience, tagline and comparison table stand.

## Consequences

- The landing page and its end-to-end test carry the new hero.
- The scorecards page is its own task under M13. It starts with itsjavi.com once TASK-486 scores it.
