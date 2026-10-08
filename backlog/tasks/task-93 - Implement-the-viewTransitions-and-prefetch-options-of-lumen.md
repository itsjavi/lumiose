---
id: TASK-93
title: Implement the viewTransitions and prefetch options of lumen()
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-08 21:32'
updated_date: '2026-10-08 21:51'
labels:
  - app
  - build
dependencies: []
references:
  - examples/ssg-travel-journal/src/document.tsx
priority: medium
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec §7.5 and §8 (Dev and config) design MPA navigation with cross-document View Transitions and speculation-rules prefetch, configured by lumen({ viewTransitions, prefetch }). Neither option exists yet (docs/reference/vite.md lists them as designed but not built), while concepts/routing.md and rendering-modes.md describe MPA navigation as if both were built in. Found by TASK-37: the ssg-travel-journal sample opts in by hand with a global '@view-transition { navigation: auto; }' rule and a <script type="speculationrules"> in src/document.tsx. The defaults (on or off, eagerness) and the option shape are a DX decision for the user/Lux before implementation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumen({ viewTransitions?: boolean }) defaults to false (opt-in per user decision-24); when true, static/server routes get @view-transition { navigation: auto } (disabled under prefers-reduced-motion) with a documented way to name elements that morph
- [x] #2 lumen({ prefetch?: "hover" | "viewport" | "none" }) defaults to "hover": generated <script type="speculationrules"> for same-origin MPA links (moderate eagerness for hover, eager+in-viewport for viewport); SPA <Link prefetch> overrides per link; options validated in the plugin
- [x] #3 Docs (routing, rendering-modes, reference/vite) updated in the same commits; the travel-journal example switches from its manual CSS/script opt-in to the options; tests
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Handler: navigation head HTML (viewTransitions <style>, prefetch speculation rules) in app/server/navigation.ts; injected by renderPage (view transitions on every page document, rules on non-spa documents).
2. Options: lumen({ viewTransitions, prefetch }) validated in vite/options.ts (minimal edit), ProjectOptions; dev plugin and build (BuildState -> BuiltApp -> createAppHandler) pass them with defaults false / "hover".
3. Rules: same-origin links under base (href_matches), endpoints excluded; hover = moderate, viewport = eager.
4. Tests (navigation unit, handler, options, build), docs (routing, rendering-modes, reference/vite), travel-journal switches to the options; e2e.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova: implementation.
- app/server/navigation.ts builds the head HTML once per handler: viewTransitions -> <style>@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}</style> on every page document (spa pages too: their client navigations are same-document, untouched; their full-page navigations then transition); prefetch -> <script type=speculationrules> on MPA documents only (spa documents: the client router navigates their links and <Link prefetch> prefetches modules, so document prefetch would be wasted).
- Rules: href_matches base+'*' ('/*', or '/docs{/*}?' under a base), minus the URL patterns of endpoints ({not:{href_matches:[...]}}; a GET endpoint may act, e.g. /logout, and is no page). Route segments -> URLPattern: params :pN, rest {/*}?, optional trailing slash {/}?, syntax chars escaped; checked with Node's URLPattern. hover = eagerness moderate, viewport = eager. Speculation rules have no in-viewport predicate; eager is the declarative equivalent (browser-chosen early prefetch), documented as such.
- Options: lumen({ viewTransitions, prefetch }) validated in vite/options.ts (minimal edit in Photon's file, after Photon committed TASK-70); ProjectOptions + navigationOptions() defaults (false, 'hover') in app/project.ts; dev passes them to createRequestHandler; build -> BuildState -> server entry data -> BuiltApp -> createAppHandler (prerender and server routes). createRequestHandler itself defaults to off (internal API; tests unchanged).
- travel-journal: vite.config lumen({ mode: 'static', viewTransitions: true }); document.tsx loses its speculation-rules script; _layout loses @view-transition and the now redundant reduced-motion block; README updated; e2e gains 'navigations are view-transitioned, and a link prefetches its page on hover' (checks the @view-transition rule and a Sec-Purpose: prefetch request on hover in Chromium).
- Proposal for the user (not implemented, DX decision): a per-link opt-out for MPA prefetch (e.g. <Link prefetch="none"> also outside spa subtrees, or rel=nofollow as WordPress does). Today the escape hatches are prefetch: 'none' or hand-written rules.
Evidence: navigation.test.ts (7: default off, VT on page/server/spa/404 docs, hover rules with endpoints excluded on MPA docs and none on spa docs, viewport under base, URLPattern matching), options.test.ts (validation), dev-server.test.ts (dev default rules, no VT), build.test.ts (prerendered + entry-served server route carry both). pnpm typecheck, pnpm test (98 files, 988 tests), pnpm lint (0 errors), docs:check green; travel-journal e2e 15/15, ssr-bookshelf e2e 14/14.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen({ viewTransitions, prefetch }) are implemented per decision-24, in dev and build. viewTransitions (default false) adds a reduced-motion-aware @view-transition opt-in to every page document; prefetch (default 'hover'; 'viewport', 'none') adds speculation rules for same-origin links below base on MPA pages, endpoints excluded, with spa pages left to <Link prefetch>. Options are validated in lumen/vite; docs (routing, rendering-modes, reference/vite, reference/router) updated; travel-journal uses the options and its e2e verifies a hover prefetch in Chromium. Follow-up proposal (needs user approval): a per-link opt-out for MPA prefetch.
<!-- SECTION:FINAL_SUMMARY:END -->
