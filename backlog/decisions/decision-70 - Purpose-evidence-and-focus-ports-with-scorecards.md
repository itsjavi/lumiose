---
id: decision-70
title: 'Purpose, evidence and focus: ports with scorecards'
date: '2026-10-20 21:20'
status: accepted
---
## Context

On 2026-10-20 the user asked whether Lumiose was turning into Astro. In the grilling session that followed (Lux, 2026-10-20), the user and Lux worked through what Lumiose is for. What came out:

- **The page model is Astro's.** Pages are server HTML with no JavaScript by default. `client:*` islands use the same directive names. Content works as components, with file routes and adapters. On static and content sites the fullstack benchmark shows the two level: 0 kB each, 1,323 vs 1,247 requests per second.
- **The difference is one component model.** Lumiose uses one model across static, server, islands and SPA, where Astro needs a second UI framework for anything interactive. The user felt that cost in the Astro version of itsjavi.com, along with untyped data in client scripts.
- **The closest alternative isn't benchmarked.** Astro with Solid islands is the nearest competitor, and no benchmark here measures it.
- **The project grew wide.** In 17 days it gained four adapters, editor tooling, lint and format plugins, evals and a UI library, all maintained by one person.

## Decision

Approved by the user on 2026-10-20.

**Purpose.** Lumiose is a research and showcase project, and its author is its first user. Ports of the author's own projects test its value. Public adoption has to be earned through that evidence; it is not the goal.

**Evidence.** Every port records a scorecard against its original stack in doc-11. It covers JavaScript shipped, build time, runtime numbers, source lines, and what got easier or harder. Public claims about Lumiose come from those scorecards and the existing benchmarks. When a port shows Lumiose isn't clearly better on something that matters, that becomes a task or an honest note. There is no stop rule.

**Ports, in order:**

1. **itsjavi.com** (in progress): switch it to `?client` (decision-71) once 0.5.0 is out, then score it again.
2. **Dotmatrix Pocket** (now examples/spa-dotmatrix): an idiomatic React port in its own repository (decision-73), built with React 19, the React Compiler, Vite and CSS modules.
3. **A private app of the author's**: a list and detail slice, from React Router and Tailwind to Lumiose with scoped CSS.
4. **Later, a forms, actions and auth slice of the same app**, as the proof for those features. It uses Better Auth with email one-time codes instead of the app's own auth, and includes the onboarding step.

**Focus.** These get no new work unless a port needs them:

- The ESLint and Prettier plugins.
- The Vercel, Netlify and Cloudflare adapters (fixes only). Node and static hosting stay active.
- The agent evals.

@lumiose/ui continues as planned.

## Consequences

- Milestone M13 holds the work.
- doc-11 holds the scorecards.
- The eval runs in doc-10 P9 are on hold under this decision.
- decision-74 reworks the public positioning to match.
