---
id: TASK-13
title: Implement the DOM runtime
status: In Progress
assignee:
  - '@Spark'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 13:27'
labels: []
milestone: m-1
dependencies:
  - TASK-6
  - TASK-7
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Compiled client code needs the runtime half of the contract: templates, inserts, attributes, events, lists and branches (spec §6.3).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 template/insert/attribute/class/style/bind/attach/ref helpers implement the contract
- [ ] #2 Document-level event delegation per decision-17, with data slots and island/app boundary walking
- [ ] #3 The keyed list implements prefix/suffix trim, append/remove/clear/swap fast paths and LIS; selector() is O(1); branches are memoised; Portal and Dynamic
- [ ] #4 Unit tests in a DOM environment cover every contract function; the core+dom size budget is checked
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. core: nested lazy owners (components inside lazy rows stay lazy), unwatched hook on trigger nodes (selector key cleanup).
2. dom/hydration.ts: nullable module-level Hydrator hook (template claim + region adoption) for TASK-18.
3. dom/template.ts, writers (attr/prop/class/style), insert regions (text/node/array reconciliation, nested functions), list (trim, append/remove/clear/swap, LIS, lazy row owners, index signals only when render.length > 1), branch, selector, components/props (createComponent, restProps, mergeProps, spread, applyScope), events (document delegation, data slots, boundaries, cancelBubble, batching), bindValue/bindChecked/attach/useRef; async stubs for TASK-17.
4. dom/public.ts: Portal, Dynamic, ref<T>().
5. Tests (happy-dom): every contract function, list property test vs expected order and node identity, delegation, class/style diffing, binds, attach, Portal/Dynamic; contract.test.ts satisfies ClientRuntime.
6. Size script (vite build --lib, min+brotli) and record vs 4.5 kB.
7. pnpm typecheck/test/lint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (from TASK-42 review):
1. setAttr: for aria-* and enumerated attributes (spellcheck, draggable, contenteditable, translate, autocapitalize?), a boolean false must write "false" rather than remove the attribute. Plain boolean attributes keep the remove-on-false behaviour.
2. bindValue with a number signal (input type=number|range) reads valueAsNumber and writes number values.
3. Event names come from React-style camelCase props lowercased by the compiler (decision-17 amendment).

Lux (from TASK-43): ref<T>() must return JSX.Ref<T> (defined in src/jsx/jsx-runtime.ts, a callable with a type-only marker). The ref prop type checks it.

Spark (TASK-13 implementation, packages/lumen/src/dom + core tweaks):
Files: dom/{template,attributes,insert,list,selector,component,spread,events,element,mount,hydration,public,index}.ts; hydrate.ts stays a TASK-18 stub (re-exports the Hydrator type). scripts/size.ts + `pnpm --filter lumen size`.
Design:
- Hydration hook: dom/hydration.ts holds `export let hydrator` (set only by setHydrator). template() claims via hydrator.template(); insert/branch/list adopt hydrator.region(parent, marker) as their current nodes (reconciliation keeps claimed nodes, removes the rest; list removes unclaimed adopted nodes after its first render). Verified: in bundles that never import setHydrator, Rolldown constant-folds hydrator to undefined and drops every branch (0 bytes).
- Regions (insert/branch/mount): a value resolves to text | node | flat node list (nested functions called tracked, arrays/fragments flattened); text nodes updated in place (also positionally inside arrays), nodes kept/moved/removed by identity; each dynamic evaluation runs under a fresh lazy owner disposed before the next. branch renders the view function itself in a nested region, so reads inside the active view stay reactive while the branch is memoised on !!cond().
- list: copy of source (tracks store indices, sees in-place mutations); fast paths: clear (textContent when the list owns the parent, marker re-appended), create-all, prefix/suffix trim, swap (2 moves for the benchmark swap), append/remove-only; else Map + LIS (only rows outside the LIS move; replace-all with nothing reused clears via textContent). Rows: lazy owners (parent = list binding), index signal only when render.length > 1, multi-node/text/dynamic rows as ranges between two empty text nodes. No per-row closures (module-level arg passing).
- selector: per-key trigger nodes in a Map; isSelected compares with untrack(source) (sync reads); a renderEffect triggers only prev/next keys; key nodes are dropped when their last reader unlinks (new TriggerNode.unwatched hook in core).
- Delegation: one document listener per type; walk target -> parentNode (or $$host for portal containers) until null or an element with $$root (set by mount; islands later); calls $$name(e) or $$name($$nameData, e) (data slot detected with `in`, so undefined data still counts); currentTarget patched per handler; skips disabled elements; stops on cancelBubble; the whole walk is batched (startBatch/endBatch).
- bindValue/bindChecked keep the binding's cached value in sync with user input (so writing the previous value back before a flush still applies); numeric when type number|range and the signal holds a number.
- attach: each attachment is a user effect (runs after mount, tracked, cleanup on re-run/dispose); list changes restart all.
- createComponent: untracked, lazy owner whose parent may itself be lazy (core: nested lazy owner frames, no allocation until something registers); async functions throw a TASK-17 error; $await/$leave stubs throw.
- public.ts: ref<T>() -> JSX.Ref<T> (signal-backed callable), Portal (div container appended to mount ?? body, $$host -> marker.parentNode, removed on cleanup), Dynamic (computed component, re-created only when it changes; string tags via createElement + spread + children insert). TODO(TASK-17) Suspense/ErrorBoundary.
Core changes (Spark area): owner.ts nested lazy frames (depth-indexed stacks); reactive.ts TriggerNode.unwatched hook; internal.ts exports activeSub/currentOwner/setActiveSub/MUTABLE. +3 core tests.
PROPOSALS FOR LUX (not applied to contract files):
1. setText: booleans render "" like insert (contract says String(value)); SSR text() must match.
2. setAttr: for aria-*/enumerated (Booleanish) attributes true writes "true" (contract: true -> ""; aria-hidden="" is invalid). Server attr must match.
3. list with key(): same key + different item re-renders that row in place (render receives a plain item, so keeping the row would show a stale item). If in-place updates are wanted, the contract could pass an item accessor when key is given.
4. restProps/mergeProps snapshot key sets (descriptor copy; getters stay live); function/proxy sources for dynamic spreads are not supported.
5. spread: onX/on:x become native listeners (the compiler cannot see the events); children/key ignored; attach and bind:* unsupported in spreads.
6. Extra non-contract export lumen/dom mount(code, container) (sets $$root); a public mount/render API is still undecided (TASK-18/25).
7. Server parity gap (Nova): lumen now exports ref, Portal, Dynamic (dom/public.ts) but index.server.ts has no server variants.
Size (pnpm --filter lumen size, Vite 8 app build, min+brotli q11): typical app imports (signal, computed, effect, batch, untrack, onCleanup, onMount + template, bind, setText, setAttr, setClass, toggleClass, setStyle, insert, list, branch, selector, createComponent, delegateEvents, listen, mount) 5.75 kB -> OVER the 4.5 kB budget by ~1.25 kB; benchmark imports 5.02 kB (6 kB app budget leaves ~1 kB for app code); every export 7.28 kB; core alone 3.47 kB; dom alone 3.97 kB. Main contributors: core effect/owner/reactive/system (~half), dom list.ts and insert.ts. Tuning candidate for TASK-12.
Validation: pnpm typecheck OK; pnpm test OK (395 tests; dom 82 in 12 files, core 89); pnpm lint: 0 errors, no warnings in src/dom or src/core. List property test: 4 variants (no marker, marker+static siblings, multi-node ranges, indexed) x 400 random ops checked against expected order, node identity, live row owners and index values; mutations (never move, wrong swap, no index update, LIS off-by-one, no dispose on remove, no item replacement) are each caught.
<!-- SECTION:NOTES:END -->
