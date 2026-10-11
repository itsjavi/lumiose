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
- Descriptor: "Lumiose is a web framework for everything from static sites and SPAs to full-stack apps: TSX with scoped CSS built in, signals, and 0 kB of JavaScript until a page needs it."

**Hero.**

- Eyebrow: "Static · Server · Islands · SPA — one framework".
- H1: the tagline.
- Sub: TSX with scoped CSS built in, per-route rendering, and 0 kB of JavaScript until a page needs it.
- CTAs: Get started, Compare the stacks, Playground.
- Proof row: 1.05× vanilla JS, 0 kB JS on server pages, 6.5 kB app.

**Directly below the hero: a stack comparison table.**

- Rows: React + Next.js, React Router, Solid + SolidStart, Svelte + SvelteKit, Vue + Nuxt, Preact, Remix 3, Astro and Lumiose.
- Columns: full-stack layer, styles, JS on a server page, client speed, and whether interactive parts use the same components.
- Astro's row is honest: it also ships 0 kB, and its islands need a second UI framework.
- Every cell comes from committed results, with no "not measured" cells at launch. To fill them, the fullstack app is ported to SolidStart, SvelteKit, Nuxt and Remix 3, and js-framework-benchmark gains Vue and Preact entries.

**Then, in this order:**

1. Familiar to write. React-like JSX, one file per component with scoped CSS, and stock TypeScript, shown with a live, editable demo that runs the WASM compiler.
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

**Amendment, 2026-10-11 (user): a lean landing and the site's structure.**

- **The landing stays lean:**
  - the hero, with the pre-release note as a badge
  - the stack table
  - four short sections, each with one sentence, one visual and one link: familiar to write, every rendering mode, light and fast, explicit for you and your agent
  - a closing CTA
- **Depth moves to other pages:**
  - performance charts to `/benchmarks`
  - mode cards and the examples grid to `/showcase`
  - tooling, security and the toolchain to the docs and the footer
- **The playground becomes a route of the main site** (`/playground`), with the site's header.
- **Real apps live under `/showcase/<slug>/` and are indexed:**
  - `/showcase/chiptune-tracker/`
  - `/showcase/dotmatrix/`
- **Samples with dummy content live under `/demos/<slug>/`,** with `noindex` and no sitemap entries:
  - `/demos/travel-journal/`
  - `/demos/counter/`
- **Repository folders keep their names.**
- **Old `/examples/...` URLs redirect without loss.** The publicly shared Dotmatrix links carry songs in `?song=…`, so the redirect keeps the path, query and hash.
- **The showcase apps get a real first render** through build-time SPA prerendering (decision-38).

**Amendment, 2026-10-11 (user): wording and visual direction.**

- **Wording.** The descriptor says "TSX with scoped CSS built in" instead of "TSX with first-class CSS". It is concrete about what you get, and it matches the stack table's "Styles: Built in" column. "Embedded CSS" was rejected because it usually means a `<style>` block in the HTML document. "Support" was rejected because it sounds like an optional add-on.
- **Visual direction.** The landing uses design spike A, "Lumen" (`.local/design-spike/a-lumen.html`):
  - A dark page lit by a three.js light source.
  - The menu sits on a solid bar.
  - A scrim behind the copy guarantees contrast.
  - The ambient motion has a pause control and honours reduced motion (decision-39).
- **Rejected directions:**
  - The prism, as too close to Vercel's visual language.
  - The "lit windows" building, as not appealing.

**Amendment, 2026-10-11 (user): descriptor wording.** The descriptor now reads: "Lumiose is a web framework for everything from static sites and SPAs to full-stack apps: TSX with scoped CSS built in, signals, and 0 kB of JavaScript until a page needs it."

- **"from static sites and SPAs to full-stack apps":** orders the range from simple to complex.
- **"until a page needs it":** replaces "where pages don't move", which was vague (CSS animates without JavaScript).
- **"where pages don't need interactivity" was rejected.** Links and forms are interactive and still ship 0 kB.

**Amendment, 2026-10-11 (user): the stack table.**

- **Order:** Lumiose comes first, then the other stacks by npm downloads of each stack's main package, with the metric and period cited under the table.
- **Lumiose's row:** a flat tint, not a gradient.
- **Server speed replaces "interactive parts use the same components".** It is two columns under a single "Server speed" header with no sub-titles. Each cell carries its unit.
  - Rendering: renders/s, from the SSR benchmark.
  - Requests: req/s on the fullstack comparison's home page.
- **Astro's caveat** (its islands need a second UI framework) moves to a note under the table.
- **New sources:**
  - Astro gets a fullstack port (TASK-242).
  - Preact, Astro and Remix 3 join the SSR benchmark (TASK-241).
- **Headings:** "One framework where others need two" read as passive-aggressive.
  - The hero H1 becomes "The best of every stack, in one framework". The page's main heading is about Lumiose, not React.
  - The tagline "Feels like React. Runs like vanilla JS." becomes the stack table's heading, above the numbers that back it up.
  - The tagline stays in the page title, the README and `package.json`.
- **Eyebrow:** "Static sites · Server-side rendering · Islands · SPAs". These are the terms people search for, with no acronyms. "Server" alone means nothing to a search engine.
- **Meta and OG description:** they lead with the same terms and stay under 160 characters. The visible descriptor is unchanged.

## Consequences

- The amendment adds TASK-214 (playground move), TASK-215 (URLs and redirects), and TASK-216 to TASK-218 (prerendering).

- Tasks:
  - Fullstack ports: TASK-202 (SolidStart), TASK-203 (SvelteKit), TASK-204 (Nuxt), TASK-205 (Remix 3).
  - TASK-206: Vue and Preact entries for js-framework-benchmark.
  - Agent evals: TASK-207 (3 repeats per model), TASK-208 (Next.js and React Router baseline), TASK-209 (local-model pilot).
  - TASK-210: dependency audit. The benchmark app has 139 production dependency packages, against 81 for React Router and 28 for Next.js.
  - Landing: TASK-211 (live demo island), TASK-212 (one-liner everywhere), TASK-213 (redesign).
- The landing redesign (TASK-213) waits for the ports, the benchmark entries, the eval repeats, the demo island and the one-liner. The one-liner (TASK-212) can ship first.
- Landing numbers stay a contract. They come from committed results through content modules checked by tests, as `apps/web/src/content/evidence.ts` does today.
- The copy in `apps/web/src/lib/site.ts`, `README.md` and the docs index changes. No API or syntax changes.
