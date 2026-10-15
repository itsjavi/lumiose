---
id: TASK-345
title: >-
  SPA router: route announcer and Navigation-API-equivalent focus reset in the
  History fallback
status: Done
assignee:
  - Spark
created_date: '2026-10-15 12:17'
updated_date: '2026-10-15 12:25'
labels: []
dependencies: []
priority: medium
ordinal: 347000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Screen readers announce a document load on their own, not a client-side navigation. Next.js, SvelteKit and Astro's ClientRouter add a visually hidden live region that reads the new page's title after each client navigation; Lumiose's SPA router has none. The History API fallback (packages/lumiose/src/app/router/history.ts) resets focus with a blur, which differs from the Navigation API's focusReset: "after-transition" (it overrides focus the new page set, keeps the sequential focus starting point at the old element, and resets on hash-only back/forward). Owner area: packages/lumiose/src/app/router/** (Spark).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After each client navigation to another path, a visually hidden live region (aria-live, aria-atomic) announces document.title, else the first h1's text, else the pathname
- [x] #2 No announcement on the initial load; a navigation that keeps the path (query-only) announces only when the title changed
- [x] #3 The region is created once per SPA after the root island mounts, outside the island (hydration unaffected), and removed when the SPA is disposed
- [x] #4 The History fallback resets focus like the Navigation API: after scroll restoration, to the first focusable [autofocus] element else the body (moving the sequential focus starting point), not when focus moved during the navigation, not for keep-scroll navigations (searchParams.set) nor hash-only back/forward
- [x] #5 afterNavigate hooks run after scroll, focus reset and the announcement
- [x] #6 Vitest (happy-dom) tests cover the announcement text and fallbacks, no announcement on initial load, query-only behaviour, cleanup and the fallback focus reset
- [x] #7 Docs (reference/router.md, concepts/routing.md) describe the announcer and focus behaviour; docs:gen run and docs:check green
- [x] #8 The assertive vs polite choice is recorded with its rationale
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. announcer.ts: a hidden assertive, atomic live region with the title > h1 > path name and the path-or-title-changed rule.
2. router.ts: create it in an onMount of the SPA root (after hydration, appended to body), remove it on dispose; a settle() step that announces before endNavigation() runs the afterNavigate hooks, used by both the Navigation API and the History fallback.
3. history.ts: Navigation-API-equivalent focus reset (first focusable [autofocus], else body focused for a moment with preventScroll and focusVisible: false), skipped when focus moved during the navigation, for keepScroll, and for hash-only back/forward.
4. Tests (accessibility.test.ts, announcer-hydration.test.ts), csr.test.ts adjusted, docs.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Standalone takeover: implemented by a standalone session under the Spark nickname, started from the orchestrating session (no multiagent run).

Decision (assertive, recorded here per the brief): the region uses aria-live="assertive" with aria-atomic="true". Next.js (App and Pages Router announcers: assertive, plus role=alert), SvelteKit (#svelte-announcer) and Astro's ClientRouter (.astro-route-announcer) all use assertive; a client navigation replaces the page the user was in, as a document load does (which screen readers announce at once), so it should interrupt rather than queue behind other speech such as the clicked link's name. No role=alert, which some screen readers announce twice. Name: document.title, else the first h1's text, else the pathname (Next.js and Astro; SvelteKit uses the title or 'untitled page'). Skips the initial load (all three). Same-path navigations announce only when the title changed (Next.js App Router compares titles too). The region is created imperatively after mount and appended to body, as Astro and Next.js App Router do, so the server HTML and hydration never see it; styles are set per property (a CSP without 'unsafe-inline' blocks a style attribute and cssText).

Focus reset: history.ts already reset focus (TASK-296) with blur(), which the router.ts header did not mention. It now matches the Navigation API's focusReset: "after-transition" more closely: the body is focused for a moment (tabindex -1, preventScroll, focusVisible: false, then the tabindex is restored) so the sequential focus starting point moves to the top, as SvelteKit does; autofocus candidates are tried in order until one takes focus; a focusin during the navigation keeps that focus (the spec's focus-changed check); hash-only back/forward keeps focus like an unintercepted hash traversal.

Not changed (possible follow-up): navigate() to a URL that differs only in its hash still runs as a client navigation in the History fallback (hooks, scroll, focus reset), while the Navigation API leaves it to the browser.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The SPA router now announces client navigations to screen readers and its History API fallback resets focus like the Navigation API.

- packages/lumiose/src/app/router/announcer.ts (new): visually hidden live region (aria-live=assertive, aria-atomic=true, data-l-announcer) appended to body; reads document.title, else the first h1, else the path; same-path navigations announce only when the title changed.
- router.ts: the SPA root creates it in onMount (after hydration, outside the island) and removes it on dispose; settle() announces before endNavigation() runs the afterNavigate hooks, for both the Navigation API and the fallback. Header comment updated (it said the fallback only restored scroll).
- history.ts: focus reset to the first focusable [autofocus] element, else the body focused for a moment (moves the sequential focus starting point to the top), with preventScroll and focusVisible: false; skipped when focus moved during the navigation, for keep-scroll navigations and for hash-only back/forward.
- Docs: reference/router.md (Behaviour: Scroll and focus, Announcements; afterNavigate), concepts/routing.md; llms-full.txt regenerated.

Validation: vitest run in packages/lumiose: 96 files, 1095 tests passed (new: accessibility.test.ts 12 tests, announcer-hydration.test.ts 1 test with compiled components hydrating server HTML; csr.test.ts adjusted for the region). The 4 new focus tests fail against the previous history.ts. pnpm typecheck exit 0, pnpm lint exit 0 (no warnings in the router), oxfmt clean, docs:gen run and docs:check green. Not verified in a real browser or with a screen reader; happy-dom has no Navigation API, so that path is covered by code review only.
<!-- SECTION:FINAL_SUMMARY:END -->
