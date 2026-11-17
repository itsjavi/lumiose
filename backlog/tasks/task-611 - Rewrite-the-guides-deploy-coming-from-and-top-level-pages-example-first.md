---
id: TASK-611
title: Rewrite the guides, deploy, coming-from and top-level pages example first
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-11-17T12:29:00Z'
updated_date: '2026-11-17T17:08:00Z'
labels: []
milestone: m-16
dependencies:
  - TASK-609
references:
  - backlog/assets/redesign/b-first-light.html
ordinal: 603000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Apply the docs writing guide to docs/guides, docs/deploy, docs/coming-from, stability and when-not-to-use.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every page follows the guide and its examples compile
- [x] #2 No fact is lost: content cut from a page is in the reference or linked
- [x] #3 docs:gen output, docs:check and the docs tests are green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (session beacon-20261117-t611a), part A: the guides. All eleven pages are restructured to the writing guide; the word target (about half) was NOT reached, because the guides are mostly code and third-party facts with no reference page to take them, and no fact was cut.

Word counts (wc -w, code included), before -> after: auth 4713 -> 2789 (plus the new auth-email-code 1998); editors 1054 -> 1023; i18n 2687 -> 2581; icons 617 -> 584; opentelemetry 1838 -> 1815; posthog 1051 -> 904; realtime 1716 -> 1756; sanity 1506 -> 1438; sentry 945 -> 896; stripe 1333 -> 1300; web-components 1987 -> 2005.

Shape: step pages (## N. Title) for auth (8), auth-email-code (5), icons (4), sentry (4), posthog (5), stripe (6), sanity (5), opentelemetry (5); realtime has three SSE steps, then WebSockets; i18n has three routing steps, then Choose a library, Paraglide JS and i18next. editors and web-components keep topic sections (inbound anchors #vs-code, #define-the-elements-in-the-browser, #server-data-in-attributes, #before-the-children-are-parsed and realtime #behind-a-proxy are unchanged), each opening on its code. Sections put their words before or after the code; notes, options and edge cases became callouts; Status notes moved to the end of each page.

Moved facts:
- auth: the whole email-code flow (plugin, mailer, challenge, code page, onboarding, rate limits, its three mistakes and the mail bullet of Production) -> new guides/auth-email-code.md, linked from auth step 1 and Production; index entry added to docs/README.md. db.server.ts joined step 2 (Set up Prisma).
- editors: the feature list -> its own section What the server adds (#what-the-server-adds), linked from VS Code; Zed, other editors and JetBrains merged into one section.
- web-components: the Custom Elements Everywhere score moved to the end; Elements the script creates is its own ### section.
- i18n: what Lumiose does -> a callout in step 1; the library comparison and the samples -> Choose a library.
- Dropped as duplicates of the steps: the File/Role tables of auth, i18n, sanity, sentry, posthog, stripe and opentelemetry (each row is restated by the step that shows the file).
- Nothing was moved into a reference page.

Checks: docs:gen and docs:check pass; cli src/docs tests 32 pass after docs:gen; web vitest 51 of 53 (the two failures are the search test expecting Rendering modes and the landing Counter sample, both from other workers changes). Not run: Playwright; the pages were not looked at in a browser at 1280 px. Unverified: the examples of auth, auth-email-code, i18n, realtime and icons are not check blocks (their libraries are not linked in the docs tests) and were moved verbatim; code lines over 60 characters remain where oxfmt joins them.

Generated files left uncommitted: packages/lumiose/docs/llms.txt and llms-full.txt.

Commits: 28dce751 icons, f84a29f7 sentry, c197e3b7 posthog, f7eaadf3 editors, d45b1c60 stripe, 3f7be7ad sanity, c19d6300 realtime, 6f3758d3 opentelemetry, 3466ea8b web-components, 0aa4bb84 i18n, bf3c16dd auth and auth-email-code.

Beacon (session beacon-20261117-t611b), part B: deploy/*, coming-from/*, stability, when-not-to-use. Not set Done (Lux closes).

Shape: every deploy guide is a step page (## 1. Build / Configure / Deploy / Verify, in the order the platform needs; Coolify has six steps), with a Status or For callout, the expected output in a text block, and a closing Notes section. Coming from pages keep the tested outline and open Mental model with a code pair (the framework, then Lumiose); From X to Lumiose opens with two to four side-by-side sections before the mapping tables. Stability and When not to use keep every commitment sentence as written.

The half-length aim was NOT met: these pages are config files, mapping tables and promises, and no fact was dropped, so the step structure and the code pairs added words. wc -w before -> after: deploy/README 1511 -> 1554, aws-lambda 286 -> 362, bun 210 -> 240, cloudflare 657 -> 730, coolify 587 -> 584, deno 176 -> 208, docker 990 -> 998, fly 162 -> 218, netlify 449 -> 507, railway 132 -> 161, render 208 -> 265, static 601 -> 670, vercel 599 -> 648, vps 960 -> 1077; coming-from astro 2867 -> 3107, nextjs 3007 -> 3348, react-router 2459 -> 2812, react 2091 -> 2432, solid 2553 -> 2780; stability 710 -> 732, when-not-to-use 450 -> 488. Halving them needs a destination for the mapping tables (for example a reference page per framework) and for the build-output tables of the adapters: a decision for Lux.

Moved facts (all within the same page; nothing moved to another file):
- Deploy: intro paragraphs -> Status/For callouts; How it works, Good to know and trailing caveats -> Notes; VPS proxy/ORIGIN text and What the adapter already does -> Notes; Coolify health check and monorepo -> Notes; Netlify monorepo config -> a Notes item (inline, was a toml block); Docker smoke-test check list -> only in the verification table of deploy/README (it was duplicated), linked.
- Coming from React: the mapping rows for useState, useMemo, useEffect (three rows), useRef (two rows) and use(promise) became the code-pair sections, with their details in the sentence under each pair; What goes away is a table.
- Solid: the createSignal and splitProps/mergeProps rows became code-pair sections.
- Astro: Where Astro is ahead today -> a subsection of What has no equivalent; What a real port showed -> a subsection of Example.
- Next.js and React Router: the Mental model paragraphs are ### subsections after the code pair.
- when-not-to-use: the three Use instead lines are the table at the top.

Renamed anchors, links updated: docker.md#the-dockerfile -> #1-configure (coolify.md), vps.md#the-proxy -> #3-deploy (bun.md, deno.md). Kept: vps #systemd #pm2 #caddy #nginx, docker #the-bookshelf-sample, static host anchors, vercel #nodejs-or-edge, deploy/README #verification #production-settings, stability #browsers.

Unverified: the pages were not looked at in the browser at 1280 px. The Verify steps are new: their curl lines and expected status lines (HTTP 200, 301/308, Docker healthy, Listening on http://localhost:3000/ from server.ts, wrangler dev on :8787, netlify serve on :8888, the *.fly.dev / *.onrender.com / *.up.railway.app hosts) follow the platforms defaults and were not run. The Lambda handler was reflowed (query, encoding and sent variables) without a behaviour change and not re-run. New Lumiose examples are check blocks and compile.

Checks: docs:gen, docs:check, cli src/docs tests (32) and web vitest (56) pass. Generated files left uncommitted for Lux: packages/lumiose/docs/llms.txt, llms-full.txt.

Commits: e5bedcac, 707d9a3f, 6ab04297 (deploy), 68445c66 (stability), a50a90d4 (when-not-to-use), ccd75e68 (react), 673b5d83 (solid), 97f96c45 (astro), 468d85dc (nextjs), f54ddb41 (react-router).

Beacon (session beacon-20261117-docs-close), closing pass: the 12 Verify blocks (aws-lambda has none).
- bun: confirmed by running (bun dist/server/entry.js on a free port against examples/ssr-bookshelf: HTTP/1.1 200 OK).
- deno: confirmed by running (deno serve with the page's flags: HTTP/1.1 200 OK; the bookshelf sample also needed write access to its data directory, which is the sample's, not the guide's).
- static: confirmed by running (lumiose preview on examples/ssg-travel-journal: 200 for a page, 404 with the not-found page for an unknown URL) and by reference/cli.md.
- cloudflare: confirmed by running (examples/ssr-deploy built for Cloudflare, wrangler 4.142.0 dev: Ready on port 8787 by default, curl -sI gives HTTP/1.1 200 OK).
- docker: confirmed by source, not run (the page's Dockerfile: PORT=3000, -p 3000:3000, --name my-app, HEALTHCHECK; the Listening line is the ssr template's server.ts with adapter-node, which prints localhost for 0.0.0.0; the verification table records builds and healthy).
- coolify: confirmed by source (the same Listening line; the healthy-before-replace sentence is the pre-rewrite text).
- netlify: corrected. The command now passes --port 8888 as the tested e2e script does (the default port was unconfirmed), and the expected output is the status code 200 from curl -w, not an unconfirmed HTTP/1.1 status line. Not run.
- vps: corrected. HTTP/2 200 and 301 Moved Permanently follow the page's nginx config (http2 on, return 301) and the tested Caddy row; the claim that Caddy answers 308 had no source and now reads that Caddy redirects with a status of its own.
- fly, render, railway, vercel: replaced. The hosts (my-app.fly.dev, my-app.onrender.com, my-app.up.railway.app, my-app.vercel.app) and the HTTP/2 200 lines were never confirmed: each step now says to open the URL the platform gives (Vercel: the one vercel deploy prints) and that curl -sI should show 200.
Totals: 4 confirmed by running, 2 by source, 2 corrected, 4 replaced.
AWS Lambda handler: diffed against the pre-rewrite block; only reflowed (query, encoding and sent variables, wrapped lines), same behaviour; the dropped header comment's facts are in the sentence below the code.
Viewed at 1280 px: guides/realtime, deploy/fly, and measured guides/stripe, guides/auth, deploy/netlify, vps, docker and coming-from/react: step bars present, no page overflow, tables full width. Left as is: code lines wider than the code column scroll inside their box (worst: the Dockerfile HEALTHCHECK line, kept as tested; many guide examples that oxfmt joins). Screenshots: backlog/assets/redesign/task-611-guide.jpg, task-611-deploy.jpg. Checks as in TASK-610. AC 1 left for Lux (page length).
<!-- SECTION:NOTES:END -->
