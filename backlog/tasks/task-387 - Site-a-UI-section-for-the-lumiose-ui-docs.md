---
id: TASK-387
title: 'Site: a UI section for the @lumiose/ui docs'
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-15 17:13'
updated_date: '2026-10-15 20:18'
labels:
  - ui
  - docs
  - site
milestone: m-12
dependencies:
  - TASK-353
  - TASK-355
priority: high
ordinal: 388000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User request, 2026-10-15: the Lumiose site gets its own UI section (for example /ui) that is the @lumiose/ui documentation, in the way base-ui.com and ui.shadcn.com document theirs. It needs:
- an overview: unstyled primitives, the optional default theme, installation;
- a page per component: live demo styled with @lumiose/ui/themes/default.css, parts and props, events, CSS variables, keyboard contract, accessibility notes;
- a theming page for the --lu- custom properties, with light and dark.
It is the default UI docs and getting-started reference, and grows with each component task (TASK-355 onward). The packaged Markdown docs (packages/lumiose/docs, llms.txt) stay the source for agents: generate or link one from the other rather than writing both by hand. Contract: decision-62.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The site has a UI section with an overview, installation and theming page
- [ ] #2 Every shipped component has a page with a live demo on the default theme, parts, props, events, CSS variables and its keyboard contract
- [ ] #3 The packaged docs and the site pages come from one source
- [ ] #4 The section passes the site's axe checks in light and dark
- [ ] #5 Meets WCAG 2.2 AA (doc-9 section 17): axe with the WCAG A and AA tags passes closed and open, with the default theme, in light and dark, and the manual criteria that apply are checked and recorded
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17).

2026-10-15 (user): @lumiose/ui is agent-ready like lumiose (decision-64). The component's docs page lives in packages/ui/docs/<component>.md, follows dialog.md's sections (Anatomy, API, Example, Styling, Keyboard and focus, Without JavaScript, Browser support, Related) and is listed in the UI llms.txt. The site's UI section renders packages/ui/docs (one source with the agent docs, TASK-393).

2026-10-15 (Beacon, branch claude/beacon-m12b-ee0e55): the /ui section.

Design (orchestrator-delegated technical decisions, recorded here):
- URLs: /ui is canonical (the user's example; /ui/llms.txt was already there). /ui is the README (Introduction), /ui/<page> each page of packages/ui/docs, in the order of the UI llms.txt (Overview, then Components). The old /docs/ui/* URLs are static 301 redirect pages (meta refresh, canonical, noindex). The header gets a "UI" link after Docs, the footer's Learn column "UI components", and the docs sidebar keeps its UI section, listing the same pages at their /ui URLs (they are no longer docs pages: no /docs prev/next, no /docs staticPaths). Search covers both, with the UI pages under "UI · <section>".
- One source: apps/web/src/content/docs.ts renders packages/ui/docs as the UI collection (topics ui/<name>, URLs /ui/<name>); no page is written twice. /docs and /ui share DocArticle (the page) and DocsShell (search + sidebar), moved out of the docs route.
- Live demos: the ```tsx check examples, the code the docs tests already type-check and the page shows, rendered live above their code; the page's first demo also sits at the top. Chosen over a demo file per component because the reader then sees exactly the code that runs, nothing new is introduced in packages/ui/docs (no demo-file convention to review), and a new component's examples become demos with no extra authoring. Rule (apps/web/src/content/ui-demos.ts): an example is a demo when it exports exactly one component without props; it is server-rendered (works without JavaScript as far as the component does) unless it uses signals (imports `lumiose`), `bind:`, `on:` or an event prop, then it is an island with `client:visible`. apps/web/scripts/ui-demos.ts writes them to apps/web/src/ui-demos/<page>-<n>.tsx plus index.tsx (`UiDemo`, by id), generated and committed so `lumiose check` type-checks them; src/content/ui-demos.test.ts fails `pnpm check` when they are stale (`pnpm --filter @lumiose/web ui:demos`).
- Theme scoping: the /ui page imports @lumiose/ui/styles.css and themes/default.css, so only /ui pages link them (the docs pages do not; checked in the build and by e2e). The theme styles only lu- classes and --lu- properties, and its color-scheme sits in lu.theme, so the site's unlayered color-scheme (the theme toggle's data-theme) drives light-dark() in the demos, also where the build lowers light-dark() (Lightning CSS, --lightningcss-light/dark on the root). The site's base styles are unlayered and would beat the theme's layered rules: inside a demo `.preview :deep(*) { all: revert-layer }` hands every property back to lu.theme / lu.core / the browser defaults, and the Markdown styles now target `.chunk` (the Markdown's own HTML) instead of the whole `.prose`, so a demo's Dialog.Title is not a docs h2.
- Theming: the palette (a light and a dark preview of the theme side by side, then every --lu- property with its light and dark value and a swatch) is read from themes/default.css (content/ui-theme.ts) and follows the table of the theme's properties (the one that lists `--lu-background`), wherever that table lives.

Adding a component's page and demo (apps/web/CONTRIBUTING.md, "The UI section"): its page in packages/ui/docs following dialog.md's sections, listed in the UI llms.txt (`pnpm --filter @lumiose/ui docs:gen`), appears in /ui and its navigation on its own; then `pnpm --filter @lumiose/web ui:demos` and commit apps/web/src/ui-demos; add it to PAGES and OPEN_DEMOS in apps/web/e2e/a11y.e2e.ts.

Proposed public names (user review): the URL paths /ui (Introduction) and /ui/<page> (/ui/dialog, …), with /docs/ui/* redirecting to them; the header link "UI" and the footer link "UI components". No convention inside packages/ui/docs: demos are the existing `tsx check` examples.
<!-- SECTION:NOTES:END -->
