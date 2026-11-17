---
id: TASK-612
title: 'Reference and error pages: consistent tables and one example per entry'
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
ordinal: 604000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bring docs/reference and docs/errors in line with the writing guide: a signature, a one-line summary, one example and a table of options per entry; error pages show the failing code and the fix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every reference entry has a signature, a summary and an example
- [x] #2 Every error page shows a failing example and its fix
- [x] #3 docs:gen output, docs:check and the docs tests are green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (session beacon-20261117-t612), with three sub-workers for the reference pages.

Error pages: packages/lumiose/scripts/gen-error-docs.ts writes only the header above the end marker (code, title, severity, category) from the compiler registry and keeps the hand-written body, so bodies were edited by hand and docs:check for them stays green. All 53 LUM pages now read: summary, Reported by, What it means (short), Example (failing), How to fix it (words, then the corrected example), Details (rules and edge cases moved out of the meaning, 20 pages), Related. No code, title or section name changed. Examples of compiler diagnostics were compiled with the compiler: the Example reports the code and the fix does not. Corrected on the way: LUM2002's example (a component's own signal written in setup is not reported; a shared signal is), LUM2004 and LUM4002 (the component is now defined or imported), LUM1002 got its missing example (an unknown client: directive), LUM2001 and LUM3008 fixes are whole components. The stub for a new code has an Example section.

Reference pages: adapter-node, app, cli, components, dom, query, reactivity, router, server, server-entry and vite have, per entry, words first, the signature checked against the source, one example (tsx/ts check where it compiles alone) and a Name/Type/Default/Description table. jsx and styles: words moved before their code; mcp unchanged (its tables list tools, not options). No heading renamed; ResponseContext is a new heading in app.md. Signatures corrected: lumiose() returns Plugin<LumiosePluginApi>[], createDevHandler's server type, md.frontmatter's second parameter, useQuery's overloads, QueryClientProvider's props, render takes () => Renderable.

Links: client instrumentation, island chunk and ?client links that pointed at concepts/islands.md#concept now point at reference/dom.md#client-instrumentation, #island-chunks-and-build-output and #client-scripts. The writing guide (apps/web/CONTRIBUTING.md) describes both page shapes.

Not done: the sections that TASK-610/611 appended to reference pages (app, components, dom, jsx, router, vite) are kept as written after each page's Example and were not merged with the entries; some of their text repeats entry text. query.md's examples are unchecked (the examples test does not link @lumiose/query). Not viewed in the browser at 1280 px. llms.txt and llms-full.txt are stale until docs:gen runs.

Beacon (session beacon-20261117-docs-close), closing pass, with three sub-workers for the merge. The sections appended by TASK-610 are folded in: app (entries under Data, Form actions, Routing, Request APIs, Cookies, Context types, a new Instrumentation section; Example last), vite (compiler, SVG, Markdown/HTML, inspector and testing sections before Lumiose packages), components (async detail after ErrorBoundary, head detail after Head), router (SPA router overview first, locale routing before Example), dom (islands detail before Example; loader text in the loader entry), jsx (element props, attach and bind under The JSX namespace; lists under Bindings), reactivity (scoped state under defineState; recipes before Example). Duplicates removed where two passages stated one fact (fetchJSON cache, enhancing forms, refreshing, control flow, cookies, Suspense/ErrorBoundary and Title/Meta/Head bullets, inspector option text, hydration and loader repeats, defineState payload text); every original sentence missing from a result was checked to be stated elsewhere in the page. No heading id renamed or removed; several went from ## to ###. rendering.md and security.md: bold labels that repeated their heading dropped; option signatures, examples and Name/Type/Default/Description tables added for the route exports (mode, ssr, prerender), csp and limits, a table for the default headers; security statements unchanged. The CSP header example is wrapped (with a note that it is one line). JSON script escape: the source writes every < as backslash-u003c; reference/security.md already said so, concepts/security.md was corrected. Viewed at 1280 px: reference/security, app, rendering, errors/LUM5001; measured reference/vite, components and errors/LUM2002. Left as is: signatures and examples wider than the code column scroll inside their box. Screenshot: backlog/assets/redesign/task-612-reference.jpg. Checks: docs:gen, docs:check (error docs included), cli src/docs 32 passed, web vitest 56 passed, typecheck, lint. Generated llms.txt and llms-full.txt committed.
<!-- SECTION:NOTES:END -->
