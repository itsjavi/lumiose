---
id: TASK-94
title: Drop the empty-CSS JS chunks of islands from client builds
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-08 21:32'
updated_date: '2026-10-08 21:49'
labels:
  - build
dependencies: []
priority: low
ordinal: 94000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lumen build writes one extra JS chunk per island whose only content is '/* empty css */' (56-67 bytes, e.g. dist/client/assets/Search-CRvydMe7.js next to the real Search-BcoBnrLw.js in examples/ssg-travel-journal; SearchBox-CrHPqz-x.js and three more in ssr-bookshelf). No chunk or page imports them, so they are never loaded: dead files in the deploy. Likely Vite's pure-CSS chunk handling of the island style modules (?lumen&type=style&lang.css) in the client environment. Found by TASK-37. Coordinate with Photon if the fix belongs in lumen/vite.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A client build of an app with styled islands contains no '/* empty css */' JS chunks, and island CSS links and hydration are unchanged
- [x] #2 A build test asserts it
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Find which chunk holds '/* empty css */' and why; drop it in the client build without touching island CSS links or chunks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova: cause. lumen/vite's CSS manifest emits every stylesheet as an entry of the client build (css-manifest.ts emit). When an island imports one too (its style block, or a CSS file), Rolldown moves the stylesheet module into a shared chunk and gives the entry a facade chunk whose only code is the import of that chunk. Vite's css-post then deletes the shared pure-CSS chunk and blanks the facade's import to a padded '/* empty css */' comment; the facade has no modules, so Vite keeps it. Nothing imports an entry, so no page ever loaded it. preserveSignature: false on the emitted chunks does not avoid the facade (tried).
Fix (app layer, lumen build's client environment, app/production/plugin.ts): a generateBundle hook with order 'post' (after Vite's css-post) deletes entry chunks whose facade module is a stylesheet, with no exports and only whitespace/'/* empty css */' code. The CSS manifest records the stylesheet's CSS from the shared chunk before that (normal-order generateBundle), so links are unchanged. Kept out of lumen/vite (Photon) since only lumen build emits the stylesheet entries in practice (they need a server build).
Evidence: build.test.ts 'writes no JS chunk left empty by the stylesheets of styled islands' (a styled island importing a CSS file: both stylesheets linked, island chunk preloaded, no JS file that is only empty-css comments; fails without the fix: Toggle-*.js was the facade). examples/ssg-travel-journal dist/client/assets now has 4 JS files (Search-CRvydMe7.js and ThemeToggle-BRbHrVgl.js gone), its e2e passes (15/15, islands hydrate, no LUM4006); ssr-bookshelf build has no JS file under 120 bytes and its e2e passes (14/14).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Client builds no longer write the unused '/* empty css */' JS chunk per styled island. Cause: lumen/vite emits each stylesheet as a client entry; when an island also imports it, Rolldown gives the entry an import-only facade that Vite then blanks. lumen build's client environment now deletes such facades in a post-order generateBundle (app/production/plugin.ts). Island CSS links, chunks and hydration are unchanged; build test plus travel-journal and bookshelf e2e green.
<!-- SECTION:FINAL_SUMMARY:END -->
