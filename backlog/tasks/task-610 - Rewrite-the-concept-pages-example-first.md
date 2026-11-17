---
id: TASK-610
title: Rewrite the concept pages example first
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
ordinal: 602000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Apply the docs writing guide to the remaining pages under docs/concepts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every concept page follows the guide and its examples compile
- [x] #2 No fact is lost: content cut from a page is in the reference or linked
- [x] #3 docs:gen output, docs:check and the docs tests are green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (session beacon-20261117-t610b), part B done: jsx, rendering-modes, routing, security, server, state, svg, testing. Not set Done (Lux closes).

Word counts (wc -w, code included), before -> after: jsx 2366 -> 919; rendering-modes 4322 -> 1201; routing 2004 -> 771; security 2681 -> 1095; server 2265 -> 1058; state 2256 -> 1134; svg 1461 -> 774; testing 1229 -> 857 (mostly code). Total 18584 -> 7809.

Moved facts (verbatim, appended as titled sections at the end of each page; links rewritten):
- jsx -> reference/jsx.md: Bindings and compiled idioms, Element props, When attach runs, bind: on components and custom elements, Lists and keys in depth, Common JSX mistakes.
- rendering-modes -> new reference/rendering.md (Rendering modes in depth): Setting the mode, Choosing a mode, Granularity and combining, Close to partial prerendering, Compared with Astro islands, How pages render, Prerendered SPA routes, Build (with the Status note), Common mistakes.
- routing -> reference/app.md: File routes (tree, rules, locales, Status note), Typed routes, MPA navigation: prefetch and View Transitions, Common routing mistakes; reference/router.md: The SPA router in short (with the navigation hooks example).
- security -> new reference/security.md (Security in depth): the whole Concept text in 16 sections plus Common mistakes. Nothing softened; the concept page keeps every rule as a line with a link. Fixed a pre-existing typo there: JSON scripts write every < as < (the old text read "as <"; checked in src/server/node.ts).
- server -> reference/app.md: Request context and middleware, Responses, cookies and env (with the Status note), The instrumentation file, Tracing phases with OpenTelemetry, Common server mistakes.
- state -> reference/reactivity.md: State libraries mapped, Scoped state on the server and in tests, State recipes (families, reconcile, persisted signal), Common mistakes when sharing state.
- svg -> reference/vite.md: SVG imports in depth, Common mistakes with SVG imports.
- testing -> reference/vite.md: Testing with Vitest and Playwright (with the flush() Counter test), Common testing mistakes, The three kinds of tests.

New pages registered in docs/README.md (Reference): reference/rendering.md, reference/security.md. Every heading with an inbound anchor was kept (jsx #lists-and-keys; the six rendering-modes anchors; server #concept, #crawlers-get-one-resolved-document, #instrumentation; security #concept; the three state recipe anchors), so no link outside these pages changed.

New examples (all type-checked): jsx Clicker, Tabs, Todos, NameField; security Profile; server routes/api/whoami/route.ts; testing components/TodoForm.ssr.test.tsx. The first section of Rendering modes is titled "Static by default, with staticPaths()" so the site search test still finds the page for staticPaths.

Checks: docs:gen then docs:check pass; cli src/docs tests 32 passed; web vitest 56 passed. Not run: Playwright, the 1280 px visual check, pnpm check as a whole. Generated llms.txt and llms-full.txt are regenerated in the working tree and left uncommitted for Lux.

Unverified: the unchecked svg examples (Rating, SearchButton) use the documented props but are not compiled, as the svg examples were before; the reference pages now end with appended sections that TASK-612 may want to fold into their structure.

Beacon (session beacon-20261117-t610a), part A done: async, compiler, content, data-and-actions, dev-tools, head, i18n, islands.

Word counts (wc -w, code included), before -> after: async 1381 -> 666; compiler 736 -> 422; content 1809 -> 776; data-and-actions 2484 -> 960; dev-tools 1082 -> 563; head 908 -> 419; i18n 1620 -> 693; islands 4100 -> 900.

Moved facts (verbatim, appended as sections at the end of reference pages; each concept page links them from a Details callout and from Common mistakes):
- compiler: pipeline, masking invariant, scanner rules, diagnostic shape, tooling, full mistakes -> reference/vite.md#how-the-compiler-works.
- async: await rewrite, re-runs, boundaries, in-flight helpers table, cache rules, islands replay, Status, full mistakes -> reference/components.md#async-components-in-detail.
- head: dedupe rules, server and browser behaviour, document props, head defaults, raw-text escaping, Status, full mistakes -> reference/components.md#head-and-document-in-detail.
- dev-tools: the four panels in full, Alt+click mechanics, what the inspector sees, build cost, launch-editor, the mistakes table -> reference/vite.md#the-dev-inspector.
- content: Markdown and HTML rules, how scripts load, Status, the user-card web component example, full mistakes -> reference/vite.md#markdown-and-html-imports-in-detail.
- i18n: the annotated config, URLs, declarations, missing, the request's locale, links, alternates and hreflang, site, prerendering, detection, SPA routes, messages, Status, full mistakes -> reference/router.md#locale-routing-in-detail.
- data-and-actions: all Concept text (endpoints, fetchJSON, action returns, kept values, Origin check, submit, submission, refreshing, optimistic, typed results), the checklist and issues examples, full mistakes -> reference/app.md#data-and-actions-in-detail.
- islands: records, early events, props, slots, hydration, context, searchParams, server-only boundaries, awaited data, the loader -> reference/dom.md#islands-in-detail; instrumentation.client.ts with its checked example -> #client-instrumentation; ?client rules -> #client-scripts; build output, chunk loading, packages, Status -> #island-chunks-and-build-output; full mistakes -> #mistakes-with-islands.

No heading that other pages link to was renamed: every inbound anchor is islands.md#concept, which still exists. Follow-up for the reference pass (TASK-612): the links that mean the ?client rules (coming-from/nextjs, coming-from/react-router, concepts/rendering-modes, concepts/server, guides/opentelemetry, guides/sentry, guides/web-components, reference/app, reference/dom, reference/router, reference/vite line 258) could point at reference/dom.md#client-scripts; and the appended sections repeat some text the reference already had (the fetchJSON/query cache in reference/app.md, Suspense/Title/Meta in reference/components.md), to merge there.

Examples: all checked ones pass; newly checked: the content page's config and Markdown page, the dev-tools Counter. Left unchecked as before: the i18n examples (need an i18n config for the Locale type), the zod frontmatter config and blog page of content.

Checks: docs:gen, docs:check, cli src/docs tests (32) and web vitest (56) pass. Not run: Playwright, pnpm check as a whole; pages not looked at in a browser at 1280 px. Generated llms.txt and llms-full.txt left uncommitted for Lux.

Commits: reference moves dbb3ef9d, 433b825b, 08d2819c, 238e8498, a4f0b5db, f0453dac, 860c3f4f, dc387ffd, 7606f077, cc133c07; pages 8774757a (compiler), 4f9e8b17 (async), 3f384df8 (head), adf36004 (dev-tools), b44060f5 (content), 3a9c6a40 (i18n), 40ce276c (data-and-actions), 7ef33bf3 (islands).

Beacon (session beacon-20261117-docs-close), closing pass. The facts moved out of the concept pages are now folded into the reference entries (see TASK-612) and were re-checked against the pre-merge text: nothing dropped. Corrected concepts/security.md: a JSON script writes every < as the six characters backslash-u003c (packages/lumiose/src/server/node.ts, jsonForScript: replace(/</g, "\\u003c"); the compiler's client codegen does the same); the page had lost the escape and read 'as <'. The safeNext example has two short conditions instead of one 100-character line (same behaviour). Viewed at 1280 px: concepts/security (screenshot), and measured concepts/routing and rendering-modes (no page overflow; some code blocks still scroll sideways inside their box). Screenshot: backlog/assets/redesign/task-610-concepts.jpg. Checks: docs:gen, docs:check, cli src/docs 32 passed, web vitest 56 passed, pnpm typecheck, pnpm lint (warnings only). AC 1 left for Lux: not every concept page was viewed.
<!-- SECTION:NOTES:END -->
