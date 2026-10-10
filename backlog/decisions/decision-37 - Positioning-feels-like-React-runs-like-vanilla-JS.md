---
id: decision-37
title: 'Positioning: feels like React, runs like vanilla JS'
date: '2026-10-10 22:40'
status: accepted
---
## Context

Lumiose was sold as "a TypeScript-first web framework", with four different one-liners across the README, the docs index, the site's meta description and its tagline.

A survey of eight landing pages on 2026-10-10 (React, Next.js, React Router, Remix, Solid, Svelte, Vue, Astro) found:

- None leads with TypeScript, and five never mention it.
- None gives a number for the JavaScript it ships.
- Only Solid and Astro compare themselves with other frameworks.
- Next.js already publishes agent evals, and Remix 3 markets itself to agents.

The full notes are in `.local/positioning/` (local, not tracked).

The library and its full-stack layer are separate projects almost everywhere:

- React has Next.js or React Router.
- Solid has SolidStart.
- Svelte has SvelteKit.
- Vue has Nuxt.
- Preact has no official full-stack framework.
- Astro is content-first, and its interactive islands need a second UI framework.

Lumiose is one project:

- Components with first-class CSS.
- Every rendering mode, chosen per route.
- Solid-class speed: 1.05× vanilla JS on js-framework-benchmark, and server rendering on par with Solid.
- 0 kB of JavaScript on server pages of the fullstack benchmark, against 101 kB for React Router and 119 kB for Next.js.

The landing page showed none of this in its hero.

The positions below came out of an interview with the user on 2026-10-11.

## Decision

Approved by the user on 2026-10-11.

**Audience.** React and Next.js developers who build with coding agents and want something lighter, faster and with less magic.

**One-liner.** It is used everywhere: README, meta and OG tags, `llms.txt`, the docs index, `package.json` descriptions and the site.

- Tagline: "Feels like React. Runs like vanilla JS."
- Descriptor: "Lumiose is a web framework for every kind of web app, from static sites to SPAs: TSX with first-class CSS, signals, and 0 kB of JavaScript where pages don't move."

**Hero.**

- Eyebrow: "Static · Server · Islands · SPA — one framework".
- H1: the tagline.
- Sub: TSX with first-class CSS, per-route rendering, and 0 kB where pages don't move.
- CTAs: Get started, Compare the stacks, Playground.
- Proof row: 1.05× vanilla JS, 0 kB JS on server pages, 6.5 kB app.

**Directly below the hero: a stack comparison table.**

- Rows: React + Next.js, React Router, Solid + SolidStart, Svelte + SvelteKit, Vue + Nuxt, Preact, Remix 3, Astro and Lumiose.
- Columns: full-stack layer, styles, JS on a server page, client speed, and whether interactive parts use the same components.
- Astro's row is honest: it also ships 0 kB, and its islands need a second UI framework.
- Every cell comes from committed results, with no "not measured" cells at launch. To fill them, the fullstack app is ported to SolidStart, SvelteKit, Nuxt and Remix 3, and js-framework-benchmark gains Vue and Preact entries.

**Then, in this order:**

1. Familiar to write. React-like JSX, one file per component with first-class CSS, and stock TypeScript, shown with a live, editable demo that runs the WASM compiler.
2. Every rendering mode. Static → islands → server → SPA, each linked to a live example app.
3. Light and fast, measured. The fullstack comparison against Next.js and React Router first, then js-framework-benchmark and SSR.
4. Explicit, for you and your agent. No hidden machinery, `LUMxxxx` codes with fixes, and the agent eval numbers.
5. Secure by default, the toolchain, and the pre-release note.

**Claims.**

- **Speed.** We say "within 4% of vanilla JS" and "Solid-class". Never "the fastest", never a "faster than Solid" headline, and never the smallest size (Solid's benchmark app is 4.5 kB against our 6.5 kB).
- **TypeScript.** Only as a proof point: stock TypeScript, no plugins, typed from routes to CSS. It never appears in one-liners.
- **`.stsx`.** First named in the authoring section.
- **Styles.** Neither single-file components nor `<style global>` are claimed as unique. The claims are:
  - TSX
  - several components per file
  - scope that follows placement
  - typed `$tokens` inlined at build time
  - stock tooling
- **Deployment.** Static builds run anywhere and server routes run on Node. More adapters are listed as planned.
- **Agent numbers.** Published only after 3 repeats per model, with the method and caveats. A Next.js and React Router baseline comes later.
- **Local models.** A pilot with local models (`qwen3.5:9b`, `gpt-oss:20b`) runs before any full local matrix.
- **No component catalog.**

## Consequences

- Tasks:
  - Fullstack ports: TASK-202 (SolidStart), TASK-203 (SvelteKit), TASK-204 (Nuxt), TASK-205 (Remix 3).
  - TASK-206: Vue and Preact entries for js-framework-benchmark.
  - Agent evals: TASK-207 (3 repeats per model), TASK-208 (Next.js and React Router baseline), TASK-209 (local-model pilot).
  - TASK-210: dependency audit. The benchmark app has 139 production dependency packages, against 81 for React Router and 28 for Next.js.
  - Landing: TASK-211 (live demo island), TASK-212 (one-liner everywhere), TASK-213 (redesign).
- The landing redesign (TASK-213) waits for the ports, the benchmark entries, the eval repeats, the demo island and the one-liner. The one-liner (TASK-212) can ship first.
- Landing numbers stay a contract. They come from committed results through content modules checked by tests, as `apps/web/src/content/evidence.ts` does today.
- The copy in `apps/web/src/lib/site.ts`, `README.md` and the docs index changes. No API or syntax changes.
