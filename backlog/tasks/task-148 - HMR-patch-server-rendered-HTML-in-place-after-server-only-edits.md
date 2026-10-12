---
id: TASK-148
title: 'HMR: patch server-rendered HTML in place after server-only edits'
status: Done
assignee:
  - Nova
created_date: '2026-10-09 05:24'
updated_date: '2026-10-12 20:56'
labels:
  - dev
  - hmr
milestone: m-9
dependencies:
  - TASK-147
priority: high
ordinal: 148000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-12: a 1.0 must-have (smoother dev reload); was planned only on 2026-10-09. After an edit to a server-only component, fetch the current URL's fresh HTML and morph the page DOM in place (keeping islands' DOM and state, focus and scroll) instead of a full reload, similar in spirit to React Router's hot data revalidation. Fall back to a reload when the document/head structure changes. Main risk: keeping hydration markers intact while patching.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Server-only component edits update the page without a reload; islands and scroll survive; head changes apply
- [x] #2 Fallback to reload on structural changes; tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-09: deferred (user accepted the pushback): DOM morphing after server edits risks unexpected behaviour; keep the full reload.

Status: deferred (user accepted, 2026-10-09). Not planned.

Lux 2026-10-12: revived by the user (1.0 must-have, replaces the 2026-10-09 deferral). Default in dev, no option, full reload as the fallback when the document/head structure changes. Starts after TASK-253 lands (both touch packages/vite/src/app).

Nova 2026-10-12 (TASK-148, session nova-20261012T202250Z-t148): implemented.
- Decision: hotUpdate (ssr) classifies edits. Island module that is hot-swappable: unchanged (island hot swap). All stylesheets: css-update (unchanged). Client code (a non-stylesheet module in the client graph, or reached from an island module or an SPA page/layout through ssr-graph importers): full reload as before. Everything else is server-only: css-update for its style modules plus a debounced custom HMR event `lumiose:server-update` (one per burst; a reload in the same burst wins).
- Decision: the dev client (`\0lumiose:dev` → packages/vite/src/app/dev/client.ts, injected after @vite/client by headAssets) fetches location.href and morphs (morph.ts, no dependency: a small keyed/positional morph, ~400 lines with comments).
- Decision: what may change is decided by a dev annotation the dev middleware appends to every HTML response (`<script type="application/json" data-l-dev>`, annotation.ts): method, status, errors, a `shell` hash (html/head/body start tags + executable scripts, minus JSON data, $swap and nonces) and an `islands` hash (records without awaits sorted by id, merged payload, each island slot HTML). Server-computed so the open page and its fresh copy are described the same way (after hydration the DOM no longer shows slots or the original html/body attributes, e.g. theme scripts). Reload when: overlay open, page was not a GET, status differs, redirected, non-HTML, fresh render reported errors, shell or islands hash differ, or the morph throws (MorphError, e.g. a broken island range).
- Morph: island ranges `<!--l:ID-->…<!--/l:ID-->` are opaque and the live range (comments included, which the loader holds) is moved to the new position, also into newly inserted subtrees. Keys: id, form-control name, head identity (meta name/property/charset, link rel+href or data-vite-dev-id, script/style content, title/base). Unkeyed: same tag+class first, else the node at the cursor unless a later new sibling is similar to it. Elements the server did not send (tracked at load; plus Portal containers and Vite `<style data-vite-dev-id>`) are kept. Scripts and dev stylesheet links are never modified (Vite swaps links on css-update; a link whose module the fresh page still links is never removed). New stylesheets load (3 s cap) before the body is patched; removed ones go after. Dirty input/textarea/checkbox/select values, focus + selection, and window scroll are restored. Nonces are never copied; inserted elements get the page nonce. Streamed boundaries of the fresh page are resolved like $swap.
- Evidence: morph.dom.test.ts (12, happy-dom: text/attrs, lists + keyed moves, sibling insertion keeps a form, islands kept and moved into a new wrapper, props/slot changes reload, head title/meta/stylesheets with Vite link copy and Vite style kept, foreign elements + focus + input values, moved focus/selection, streamed boundaries, fallbacks for html/body attrs, scripts, status, non-HTML, redirect, errors, POST page, overlay, broken range); annotation.test.ts (5); dev-server.test.ts updated (server edit sends lumiose:server-update, one per burst, island dependency edit reloads, annotation + dev client served). Browser: examples/ssr-bookshelf/e2e/hmr.dev.ts (Chromium, lumiose dev) now asserts a Header edit patches in place (window mark, search box value, hot-swapped AccountMenu attribute, scrollY and the "[lumiose] page updated in place." log), a head <Title> edit applies, and changing AccountMenu client:idle→client:load reloads; passed 4 runs. Ad-hoc (not committed): streamed home page and a book page with client:visible islands patched in place.
- Docs: packages/lumiose/docs/reference/cli.md (lumiose dev: what an edit updates).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Server-only edits in `lumiose dev` now patch the page in place (default, no option). The dev plugin classifies each ssr hot update: island hot swap and CSS-only updates as before; client code (in the client module graph, or reached from an island module or an SPA page/layout) reloads; everything else sends `lumiose:server-update` (debounced per burst, a reload wins). The dev client (`packages/vite/src/app/dev/client.ts`, loaded via `\0lumiose:dev`) fetches the page and morphs it (`morph.ts`, no new dependency): island ranges are opaque and moved as a unit (hydration markers and island state intact), unknown client-added elements, focus/selection, scroll and dirty form values are kept, head title/meta/stylesheets are applied (new stylesheets load first), streamed boundaries are resolved. A server-computed dev annotation on every HTML page (`annotation.ts`) decides when a patch is safe; it reloads when html/head/body start tags or scripts change, island records/payload/slot HTML change, the status changes, the response redirects or is not HTML, the page was a POST, the fresh render reported errors, the overlay is open, or the morph throws. Tests: morph.dom.test.ts (12), annotation.test.ts (5), dev-server.test.ts (updated, 16), ssr-bookshelf e2e/hmr.dev.ts in Chromium (patch keeps mark, island state and scroll; head change; island record change reloads). Docs: reference/cli.md. pnpm check: typecheck, lint, fmt, size, script tests green; vitest had 4 transient @lumiose/cli failures (docs under concurrent edit by other workers, CLI timeouts under load) that pass when re-run.
<!-- SECTION:FINAL_SUMMARY:END -->
